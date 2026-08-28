package middleware

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/songquanpeng/one-api/common/ctxkey"
	"github.com/songquanpeng/one-api/common/logger"
	"github.com/songquanpeng/one-api/model"
	"github.com/songquanpeng/one-api/relay/channeltype"
	"github.com/songquanpeng/one-api/relay/routing"
)

type ModelRequest struct {
	Model string `json:"model" form:"model"`
}

func Distribute() func(c *gin.Context) {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		userId := c.GetInt(ctxkey.Id)
		userGroup, _ := model.CacheGetUserGroup(userId)
		c.Set(ctxkey.Group, userGroup)
		var requestModel string
		var channel *model.Channel
		channelId, ok := c.Get(ctxkey.SpecificChannelId)
		if ok {
			id, err := strconv.Atoi(channelId.(string))
			if err != nil {
				abortWithMessage(c, http.StatusBadRequest, "无效的渠道 Id")
				return
			}
			channel, err = model.GetChannelById(id, true)
			if err != nil {
				abortWithMessage(c, http.StatusBadRequest, "无效的渠道 Id")
				return
			}
			if channel.Status != model.ChannelStatusEnabled {
				abortWithMessage(c, http.StatusForbidden, "该渠道已被禁用")
				return
			}
		} else {
			requestModel = c.GetString(ctxkey.RequestModel)
			// F-005 虚拟模型解析：若请求的是虚拟模型，解析为实际模型并记录
			actualModel, virtualName, specificChId := model.ResolveVirtualModel(userGroup, requestModel)
			if virtualName != "" {
				c.Set(ctxkey.VirtualModelName, virtualName)
				c.Set(ctxkey.ActualModel, actualModel)
				requestModel = actualModel
				c.Set(ctxkey.RequestModel, actualModel)
				if specificChId > 0 {
					c.Set(ctxkey.SpecificChannelId, strconv.Itoa(specificChId))
				}
			}
			var err error
			// 虚拟模型候选指定了渠道，或令牌/URL 指定了渠道时走直连
			if _, forced := c.Get(ctxkey.SpecificChannelId); forced {
				id, _ := strconv.Atoi(c.GetString(ctxkey.SpecificChannelId))
				channel, err = model.GetChannelById(id, true)
				if err == nil && channel.Status != model.ChannelStatusEnabled {
					err = fmt.Errorf("channel %d disabled", id)
				}
			} else {
				channel, err = selectChannel(userGroup, requestModel)
			}
			if err != nil {
				message := fmt.Sprintf("当前分组 %s 下对于模型 %s 无可用渠道", userGroup, requestModel)
				abortWithMessage(c, http.StatusServiceUnavailable, message)
				return
			}
		}
		logger.Debugf(ctx, "user id %d, user group: %s, request model: %s, using channel #%d", userId, userGroup, requestModel, channel.Id)
		SetupContextForSelectedChannel(c, channel, requestModel)
		c.Next()
	}
}

// selectChannel 按 F-004 智能路由策略选择渠道：候选集 → 熔断过滤 → 策略选择。
func selectChannel(group, modelName string) (*model.Channel, error) {
	candidates, err := model.CacheGetCandidateChannels(group, modelName)
	if err != nil {
		return nil, err
	}
	strategy := model.GetEffectiveStrategy(group, modelName)
	ch := routing.Select(candidates, strategy, nil)
	if ch == nil {
		return nil, fmt.Errorf("no available channel")
	}
	return ch, nil
}

func SetupContextForSelectedChannel(c *gin.Context, channel *model.Channel, modelName string) {
	c.Set(ctxkey.Channel, channel.Type)
	c.Set(ctxkey.ChannelId, channel.Id)
	c.Set(ctxkey.ChannelName, channel.Name)
	if channel.SystemPrompt != nil && *channel.SystemPrompt != "" {
		c.Set(ctxkey.SystemPrompt, *channel.SystemPrompt)
	}
	c.Set(ctxkey.ModelMapping, channel.GetModelMapping())
	c.Set(ctxkey.OriginalModel, modelName) // for retry
	// F-006 多 Key：优先从 channel_keys 选择一个健康 Key，无配置时回退 channel.Key
	apiKey, keyId, keyName := channel.SelectKey()
	c.Request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))
	if keyId > 0 {
		c.Set(ctxkey.SelectedChannelKeyId, keyId)
		c.Set(ctxkey.SelectedChannelKeyName, keyName)
	}
	c.Set(ctxkey.BaseURL, channel.GetBaseURL())
	cfg, _ := channel.LoadConfig()
	// this is for backward compatibility
	if channel.Other != nil {
		switch channel.Type {
		case channeltype.Azure:
			if cfg.APIVersion == "" {
				cfg.APIVersion = *channel.Other
			}
		case channeltype.Xunfei:
			if cfg.APIVersion == "" {
				cfg.APIVersion = *channel.Other
			}
		case channeltype.Gemini:
			if cfg.APIVersion == "" {
				cfg.APIVersion = *channel.Other
			}
		case channeltype.AIProxyLibrary:
			if cfg.LibraryID == "" {
				cfg.LibraryID = *channel.Other
			}
		case channeltype.Ali:
			if cfg.Plugin == "" {
				cfg.Plugin = *channel.Other
			}
		}
	}
	c.Set(ctxkey.Config, cfg)
}
