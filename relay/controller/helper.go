package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"

	"github.com/songquanpeng/one-api/common/helper"
	"github.com/songquanpeng/one-api/relay/constant/role"

	"github.com/gin-gonic/gin"

	"github.com/songquanpeng/one-api/common"
	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/logger"
	"github.com/songquanpeng/one-api/model"
	"github.com/songquanpeng/one-api/relay/adaptor/openai"
	billingratio "github.com/songquanpeng/one-api/relay/billing/ratio"
	"github.com/songquanpeng/one-api/relay/channeltype"
	"github.com/songquanpeng/one-api/relay/controller/validator"
	"github.com/songquanpeng/one-api/relay/meta"
	relaymodel "github.com/songquanpeng/one-api/relay/model"
	"github.com/songquanpeng/one-api/relay/relaymode"
)

func getAndValidateTextRequest(c *gin.Context, relayMode int) (*relaymodel.GeneralOpenAIRequest, error) {
	textRequest := &relaymodel.GeneralOpenAIRequest{}
	err := common.UnmarshalBodyReusable(c, textRequest)
	if err != nil {
		return nil, err
	}
	if relayMode == relaymode.Moderations && textRequest.Model == "" {
		textRequest.Model = "text-moderation-latest"
	}
	if relayMode == relaymode.Embeddings && textRequest.Model == "" {
		textRequest.Model = c.Param("model")
	}
	err = validator.ValidateTextRequest(textRequest, relayMode)
	if err != nil {
		return nil, err
	}
	return textRequest, nil
}

func getPromptTokens(textRequest *relaymodel.GeneralOpenAIRequest, relayMode int) int {
	switch relayMode {
	case relaymode.ChatCompletions:
		return openai.CountTokenMessages(textRequest.Messages, textRequest.Model)
	case relaymode.Completions:
		return openai.CountTokenInput(textRequest.Prompt, textRequest.Model)
	case relaymode.Moderations:
		return openai.CountTokenInput(textRequest.Input, textRequest.Model)
	}
	return 0
}

func getPreConsumedQuota(textRequest *relaymodel.GeneralOpenAIRequest, promptTokens int, ratio float64) int64 {
	preConsumedTokens := config.PreConsumedQuota + int64(promptTokens)
	if textRequest.MaxTokens != 0 {
		preConsumedTokens += int64(textRequest.MaxTokens)
	}
	return int64(float64(preConsumedTokens) * ratio)
}

func preConsumeQuota(ctx context.Context, textRequest *relaymodel.GeneralOpenAIRequest, promptTokens int, ratio float64, meta *meta.Meta) (int64, *relaymodel.ErrorWithStatusCode) {
	preConsumedQuota := getPreConsumedQuota(textRequest, promptTokens, ratio)

	userQuota, err := model.CacheGetUserQuota(ctx, meta.UserId)
	if err != nil {
		return preConsumedQuota, openai.ErrorWrapper(err, "get_user_quota_failed", http.StatusInternalServerError)
	}
	if userQuota-preConsumedQuota < 0 {
		return preConsumedQuota, openai.ErrorWrapper(errors.New("user quota is not enough"), "insufficient_user_quota", http.StatusForbidden)
	}
	err = model.CacheDecreaseUserQuota(meta.UserId, preConsumedQuota)
	if err != nil {
		return preConsumedQuota, openai.ErrorWrapper(err, "decrease_user_quota_failed", http.StatusInternalServerError)
	}
	if userQuota > 100*preConsumedQuota {
		// in this case, we do not pre-consume quota
		// because the user has enough quota
		preConsumedQuota = 0
		logger.Info(ctx, fmt.Sprintf("user %d has enough quota %d, trusted and no need to pre-consume", meta.UserId, userQuota))
	}
	if preConsumedQuota > 0 {
		err := model.PreConsumeTokenQuota(meta.TokenId, preConsumedQuota)
		if err != nil {
			return preConsumedQuota, openai.ErrorWrapper(err, "pre_consume_token_quota_failed", http.StatusForbidden)
		}
	}
	return preConsumedQuota, nil
}

func postConsumeQuota(ctx context.Context, usage *relaymodel.Usage, meta *meta.Meta, textRequest *relaymodel.GeneralOpenAIRequest, ratio float64, preConsumedQuota int64, modelRatio float64, groupRatio float64, systemPromptReset bool) {
	if usage == nil {
		logger.Error(ctx, "usage is nil, which is unexpected")
		return
	}
	var quota int64
	completionRatio := billingratio.GetCompletionRatio(textRequest.Model, meta.ChannelType)
	promptTokens := usage.PromptTokens
	completionTokens := usage.CompletionTokens
	// 缓存命中/写入 token 数（从 OpenAI 的 prompt_tokens_details.cached_tokens 或 Anthropic 的 cache_* 字段解析得到）
	cacheHitTokens := usage.CacheHitTokens
	cacheWriteTokens := usage.CacheWriteTokens
	// 兜底：若 PromptTokensDetails.CachedTokens 存在而 CacheHitTokens 未映射，则补齐
	if cacheHitTokens == 0 {
		if usage.PromptTokensDetails != nil {
			cacheHitTokens = usage.PromptTokensDetails.CachedTokens
		}
		if cacheHitTokens == 0 {
			cacheHitTokens = usage.PromptCacheHitTokens
		}
	}
	// 防御：缓存命中+写入的 token 不应超过输入 token 总数（仅作用于计费副本，避免篡改落库的原始缓存统计数据）
	if cacheHitTokens < 0 {
		cacheHitTokens = 0
	}
	if cacheWriteTokens < 0 {
		cacheWriteTokens = 0
	}
	billingCacheHitTokens := cacheHitTokens
	billingCacheWriteTokens := cacheWriteTokens
	if billingCacheHitTokens+billingCacheWriteTokens > promptTokens {
		// 异常时按比例回退，避免计费为负或超过输入
		over := billingCacheHitTokens + billingCacheWriteTokens - promptTokens
		if billingCacheWriteTokens >= over {
			billingCacheWriteTokens -= over
		} else {
			billingCacheHitTokens -= (over - billingCacheWriteTokens)
			billingCacheWriteTokens = 0
		}
	}
	cacheHitRatio := billingratio.GetCacheHitRatio(textRequest.Model, meta.ChannelType)
	cacheWriteRatio := billingratio.GetCacheWriteRatio(textRequest.Model, meta.ChannelType)
	normalPromptTokens := promptTokens - billingCacheHitTokens - billingCacheWriteTokens
	// 计费 = (正常输入 + 缓存命中×折扣 + 缓存写入×加价 + 输出×输出倍率) × 模型倍率 × 分组倍率
	quota = int64(math.Ceil((float64(normalPromptTokens) +
		float64(billingCacheHitTokens)*cacheHitRatio +
		float64(billingCacheWriteTokens)*cacheWriteRatio +
		float64(completionTokens)*completionRatio) * ratio))
	if ratio != 0 && quota <= 0 {
		quota = 1
	}
	totalTokens := promptTokens + completionTokens
	if totalTokens == 0 {
		// in this case, must be some error happened
		// we cannot just return, because we may have to return the pre-consumed quota
		quota = 0
	}
	quotaDelta := quota - preConsumedQuota
	err := model.PostConsumeTokenQuota(meta.TokenId, quotaDelta)
	if err != nil {
		logger.Error(ctx, "error consuming token remain quota: "+err.Error())
	}
	err = model.CacheUpdateUserQuota(ctx, meta.UserId)
	if err != nil {
		logger.Error(ctx, "error update user quota cache: "+err.Error())
	}
	logContent := fmt.Sprintf("倍率：%.2f × %.2f × %.2f", modelRatio, groupRatio, completionRatio)
	// 口径一致：Content 展示与实际计费统一使用钳制后的 billingCacheHitTokens/billingCacheWriteTokens
	if billingCacheHitTokens > 0 {
		logContent += fmt.Sprintf("（缓存命中 %d，折扣 %.2f）", billingCacheHitTokens, cacheHitRatio)
	}
	if billingCacheWriteTokens > 0 {
		logContent += fmt.Sprintf("（缓存写入 %d，加价 %.2f）", billingCacheWriteTokens, cacheWriteRatio)
	}
	// 首字延迟(ms)：仅流式且确有首字时有效，否则 0
	firstTokenMs := int64(0)
	if meta.IsStream && !meta.FirstTokenTime.IsZero() {
		firstTokenMs = meta.FirstTokenTime.Sub(meta.StartTime).Milliseconds()
	}
	// 结构化计费明细（钳制后值，供公式反查与前端展示）
	billingDetail := model.BillingDetail{
		Model:             meta.OriginModelName,
		ModelRatio:        modelRatio,
		GroupRatio:        groupRatio,
		CompletionRatio:   completionRatio,
		CacheHitRatio:     cacheHitRatio,
		CacheWriteRatio:   cacheWriteRatio,
		ChannelType:       meta.ChannelType,
		PromptTokens:      promptTokens,
		CompletionTokens:  completionTokens,
		CacheHitTokens:    cacheHitTokens,
		CacheWriteTokens:  cacheWriteTokens,
		BillingCacheHit:   billingCacheHitTokens,
		BillingCacheWrite: billingCacheWriteTokens,
		NormalPrompt:      normalPromptTokens,
		Quota:             int(quota),
	}
	billingDetailJSON, _ := json.Marshal(billingDetail)
	model.RecordConsumeLog(ctx, &model.Log{
		UserId:            meta.UserId,
		ChannelId:         meta.ChannelId,
		Group:             meta.Group,
		Ip:                meta.Ip,
		PromptTokens:      promptTokens,
		CompletionTokens:  completionTokens,
		CacheHitTokens:    cacheHitTokens,
		CacheWriteTokens:  cacheWriteTokens,
		ModelName:         textRequest.Model,
		TokenName:         meta.TokenName,
		Quota:             int(quota),
		Content:           logContent,
		IsStream:          meta.IsStream,
		ElapsedTime:       helper.CalcElapsedTime(meta.StartTime),
		FirstTokenTime:    firstTokenMs,
		BillingDetail:     string(billingDetailJSON),
		SystemPromptReset: systemPromptReset,
	})
	model.UpdateUserUsedQuotaAndRequestCount(meta.UserId, quota)
	model.UpdateChannelUsedQuota(meta.ChannelId, quota)
}

func getMappedModelName(modelName string, mapping map[string]string) (string, bool) {
	if mapping == nil {
		return modelName, false
	}
	mappedModelName := mapping[modelName]
	if mappedModelName != "" {
		return mappedModelName, true
	}
	return modelName, false
}

func isErrorHappened(meta *meta.Meta, resp *http.Response) bool {
	if resp == nil {
		if meta.ChannelType == channeltype.AwsClaude {
			return false
		}
		return true
	}
	if resp.StatusCode != http.StatusOK &&
		// replicate return 201 to create a task
		resp.StatusCode != http.StatusCreated {
		return true
	}
	if meta.ChannelType == channeltype.DeepL {
		// skip stream check for deepl
		return false
	}

	if meta.IsStream && strings.HasPrefix(resp.Header.Get("Content-Type"), "application/json") &&
		// Even if stream mode is enabled, replicate will first return a task info in JSON format,
		// requiring the client to request the stream endpoint in the task info
		meta.ChannelType != channeltype.Replicate {
		return true
	}
	return false
}

func setSystemPrompt(ctx context.Context, request *relaymodel.GeneralOpenAIRequest, prompt string) (reset bool) {
	if prompt == "" {
		return false
	}
	if len(request.Messages) == 0 {
		return false
	}
	if request.Messages[0].Role == role.System {
		request.Messages[0].Content = prompt
		logger.Infof(ctx, "rewrite system prompt")
		return true
	}
	request.Messages = append([]relaymodel.Message{{
		Role:    role.System,
		Content: prompt,
	}}, request.Messages...)
	logger.Infof(ctx, "add system prompt")
	return true
}

// VerifyBillingDetail 用计费明细反推 quota，返回 (反推值, 是否匹配)。
// 注意与 postConsumeQuota 的两处兜底一致：
//   (1) ratio!=0 && quota<=0 → 强制 1；
//   (2) totalTokens==0 → quota 强制 0。
// 可用于：管理后台「校验日志计费一致性」脚本、或前端展示「反推值 vs 实际值」的一致性标识。
func VerifyBillingDetail(d model.BillingDetail) (int64, bool) {
	if d.PromptTokens+d.CompletionTokens == 0 {
		return 0, d.Quota == 0
	}
	raw := (float64(d.NormalPrompt) +
		float64(d.BillingCacheHit)*d.CacheHitRatio +
		float64(d.BillingCacheWrite)*d.CacheWriteRatio +
		float64(d.CompletionTokens)*d.CompletionRatio) * d.ModelRatio * d.GroupRatio
	recomputed := int64(math.Ceil(raw))
	if d.ModelRatio*d.GroupRatio != 0 && recomputed <= 0 {
		recomputed = 1
	}
	return recomputed, recomputed == int64(d.Quota)
}
