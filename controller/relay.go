package controller

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/common"
	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/ctxkey"
	"github.com/songquanpeng/one-api/common/helper"
	"github.com/songquanpeng/one-api/common/logger"
	"github.com/songquanpeng/one-api/middleware"
	dbmodel "github.com/songquanpeng/one-api/model"
	"github.com/songquanpeng/one-api/monitor"
	"github.com/songquanpeng/one-api/relay/controller"
	"github.com/songquanpeng/one-api/relay/model"
	"github.com/songquanpeng/one-api/relay/relaymode"
	"github.com/songquanpeng/one-api/relay/routing"
)

// https://platform.openai.com/docs/api-reference/chat

func relayHelper(c *gin.Context, relayMode int) *model.ErrorWithStatusCode {
	var err *model.ErrorWithStatusCode
	switch relayMode {
	case relaymode.ImagesGenerations:
		err = controller.RelayImageHelper(c, relayMode)
	case relaymode.AudioSpeech:
		fallthrough
	case relaymode.AudioTranslation:
		fallthrough
	case relaymode.AudioTranscription:
		err = controller.RelayAudioHelper(c, relayMode)
	case relaymode.Proxy:
		err = controller.RelayProxyHelper(c, relayMode)
	default:
		err = controller.RelayTextHelper(c)
	}
	return err
}

func Relay(c *gin.Context) {
	ctx := c.Request.Context()
	relayMode := relaymode.GetByPath(c.Request.URL.Path)
	if config.DebugEnabled {
		requestBody, _ := common.GetRequestBody(c)
		logger.Debugf(ctx, "request body: %s", string(requestBody))
	}
	channelId := c.GetInt(ctxkey.ChannelId)
	userId := c.GetInt(ctxkey.Id)
	bizErr := relayHelper(c, relayMode)
	if bizErr == nil {
		monitor.Emit(channelId, true)
		monitor.RecordChannelResult(channelId, true, true) // F-004 熔断器：成功
		monitor.RecordRequest(channelId, c.GetString(ctxkey.OriginalModel), http.StatusOK, "")
		return
	}
	lastFailedChannelId := channelId
	channelName := c.GetString(ctxkey.ChannelName)
	group := c.GetString(ctxkey.Group)
	originalModel := c.GetString(ctxkey.OriginalModel)
	triedChannels := map[int]bool{channelId: true}
	go processChannelRelayError(ctx, userId, channelId, channelName, c.GetInt(ctxkey.SelectedChannelKeyId), *bizErr)
	requestId := c.GetString(helper.RequestIdKey)
	retryTimes := config.RetryTimes
	if !shouldRetry(c, bizErr.StatusCode) {
		logger.Errorf(ctx, "relay error happen, status code is %d, won't retry in this case", bizErr.StatusCode)
		retryTimes = 0
	}
	// 候选集（用于 fallback 链与策略选择），失败时懒加载
	var candidates []*dbmodel.Channel
	for i := retryTimes; i > 0; i-- {
		var channel *dbmodel.Channel
		// 1) 优先走上一次失败渠道配置的 fallback_order 链
		if lastCh, _ := dbmodel.GetChannelById(lastFailedChannelId, false); lastCh != nil && lastCh.Id != 0 {
			if candidates == nil {
				candidates, _ = dbmodel.CacheGetCandidateChannels(group, originalModel)
			}
			if chain := routing.FallbackChain(lastCh, candidates, triedChannels); len(chain) > 0 {
				channel = chain[0]
			}
		}
		// 2) fallback 链无可用渠道时，按路由策略从候选集中选择（排除已尝试）
		if channel == nil {
			if candidates == nil {
				candidates, _ = dbmodel.CacheGetCandidateChannels(group, originalModel)
			}
			strategy := dbmodel.GetEffectiveStrategy(group, originalModel)
			channel = routing.Select(candidates, strategy, triedChannels)
		}
		if channel == nil {
			logger.Errorf(ctx, "no more available channels for retry")
			break
		}
		triedChannels[channel.Id] = true
		logger.Infof(ctx, "using channel #%d to retry (remain times %d)", channel.Id, i)
		middleware.SetupContextForSelectedChannel(c, channel, originalModel)
		requestBody, err := common.GetRequestBody(c)
		if err != nil {
			logger.Errorf(ctx, "failed to get request body for retry: %s", err.Error())
			break
		}
		c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		bizErr = relayHelper(c, relayMode)
		if bizErr == nil {
			monitor.RecordChannelResult(channel.Id, true, true)
			monitor.RecordRequest(channel.Id, originalModel, http.StatusOK, "")
			return
		}
		// 流式响应一旦开始向客户端写入 body，重试会导致客户端收到重复/混乱数据，此时不再重试
		if c.Writer.Size() > 0 {
			logger.Errorf(ctx, "relay error after response body started writing, won't retry: %s", bizErr.Error.Message)
			break
		}
		channelId := c.GetInt(ctxkey.ChannelId)
		lastFailedChannelId = channelId
		channelName := c.GetString(ctxkey.ChannelName)
		go processChannelRelayError(ctx, userId, channelId, channelName, c.GetInt(ctxkey.SelectedChannelKeyId), *bizErr)
	}
	if bizErr != nil {
		if bizErr.StatusCode == http.StatusTooManyRequests {
			bizErr.Error.Message = "当前分组上游负载已饱和，请稍后再试"
		}
		// F-010 记录最终失败请求指标
		monitor.RecordRequest(c.GetInt(ctxkey.ChannelId), c.GetString(ctxkey.OriginalModel), bizErr.StatusCode, classifyError(bizErr, bizErr.StatusCode))

		// 使用局部副本组装响应，避免原地改写上游返回的错误对象
		finalErr := *bizErr
		finalErr.Error.Message = helper.MessageWithRequestId(finalErr.Error.Message, requestId)
		c.JSON(finalErr.StatusCode, gin.H{
			"error": finalErr.Error,
		})
	}
}

func shouldRetry(c *gin.Context, statusCode int) bool {
	if _, ok := c.Get(ctxkey.SpecificChannelId); ok {
		return false
	}
	if statusCode == http.StatusTooManyRequests {
		return true
	}
	if statusCode/100 == 5 {
		return true
	}
	if statusCode == http.StatusBadRequest {
		return false
	}
	if statusCode/100 == 2 {
		return false
	}
	return true
}

func processChannelRelayError(ctx context.Context, userId int, channelId int, channelName string, keyId int, err model.ErrorWithStatusCode) {
	logger.Errorf(ctx, "relay error (channel id %d, user id: %d): %s", channelId, userId, err.Message)
	// https://platform.openai.com/docs/guides/error-codes/api-errors
	if monitor.ShouldDisableChannel(&err.Error, err.StatusCode) {
		monitor.DisableChannel(channelId, channelName, err.Message)
	} else {
		monitor.Emit(channelId, false)
	}
	// F-004 熔断器：仅对可重试错误（429/5xx）计失败，4xx 业务错误不熔断渠道
	retryable := err.StatusCode == http.StatusTooManyRequests || err.StatusCode/100 == 5
	monitor.RecordChannelResult(channelId, false, retryable)
	// F-006 多 Key：认证/额度类错误隔离具体 Key（而非整渠道）
	if keyId > 0 && isKeyAuthError(err) {
		if qerr := dbmodel.QuarantineChannelKey(keyId, err.Message); qerr != nil {
			logger.SysError("failed to quarantine channel key: " + qerr.Error())
		} else {
			logger.Infof(ctx, "channel key #%d quarantined due to auth error", keyId)
		}
	}
}

// isKeyAuthError 判断是否为 Key 级认证/额度错误（401/403/insufficient_quota/invalid_api_key）。
func isKeyAuthError(err model.ErrorWithStatusCode) bool {
	if err.StatusCode == http.StatusUnauthorized || err.StatusCode == http.StatusForbidden {
		return true
	}
	code := strings.ToLower(fmt.Sprintf("%v", err.Error.Code))
	if strings.Contains(code, "insufficient_quota") || strings.Contains(code, "invalid_api_key") ||
		strings.Contains(code, "account_deactivated") || strings.Contains(code, "billing") {
		return true
	}
	return false
}

func RelayNotImplemented(c *gin.Context) {
	err := model.Error{
		Message: "API not implemented",
		Type:    "one_api_error",
		Param:   "",
		Code:    "api_not_implemented",
	}
	c.JSON(http.StatusNotImplemented, gin.H{
		"error": err,
	})
}

func RelayNotFound(c *gin.Context) {
	err := model.Error{
		Message: fmt.Sprintf("Invalid URL (%s %s)", c.Request.Method, c.Request.URL.Path),
		Type:    "invalid_request_error",
		Param:   "",
		Code:    "",
	}
	c.JSON(http.StatusNotFound, gin.H{
		"error": err,
	})
}
