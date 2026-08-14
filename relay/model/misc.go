package model

type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`

	// CacheHitTokens 表示命中缓存的输入 token 数（读缓存，通常比正常输入便宜）
	CacheHitTokens int `json:"cache_hit_tokens,omitempty"`
	// CacheWriteTokens 表示写入缓存的输入 token 数（写缓存，通常比正常输入贵）
	CacheWriteTokens int `json:"cache_write_tokens,omitempty"`
	// PromptCacheHitTokens 为 DeepSeek 风格的顶层缓存命中字段（prompt_cache_hit_tokens），解析后映射到 CacheHitTokens
	PromptCacheHitTokens int `json:"prompt_cache_hit_tokens,omitempty"`

	CompletionTokensDetails *CompletionTokensDetails `json:"completion_tokens_details,omitempty"`
	// PromptTokensDetails OpenAI 兼容的 prompt_tokens_details.cached_tokens，解析后映射到 CacheHitTokens
	PromptTokensDetails *PromptTokensDetails `json:"prompt_tokens_details,omitempty"`
}

type PromptTokensDetails struct {
	CachedTokens int `json:"cached_tokens"`
}

type CompletionTokensDetails struct {
	ReasoningTokens          int `json:"reasoning_tokens"`
	AcceptedPredictionTokens int `json:"accepted_prediction_tokens"`
	RejectedPredictionTokens int `json:"rejected_prediction_tokens"`
}

type Error struct {
	Message string `json:"message"`
	Type    string `json:"type"`
	Param   string `json:"param"`
	Code    any    `json:"code"`
}

type ErrorWithStatusCode struct {
	Error
	StatusCode int `json:"status_code"`
}
