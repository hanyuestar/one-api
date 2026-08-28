package ctxkey

const (
	Config            = "config"
	Id                = "id"
	Username          = "username"
	Role              = "role"
	Status            = "status"
	Channel           = "channel"
	ChannelId         = "channel_id"
	SpecificChannelId = "specific_channel_id"
	RequestModel      = "request_model"
	ActualModel       = "actual_model" // F-005: 虚拟模型解析后的真实模型名
	ConvertedRequest  = "converted_request"
	OriginalModel     = "original_model"
	Group             = "group"
	ModelMapping      = "model_mapping"
	ChannelName       = "channel_name"
	TokenId           = "token_id"
	TokenName         = "token_name"
	BaseURL           = "base_url"
	AvailableModels   = "available_models"
	KeyRequestBody    = "key_request_body"
	SystemPrompt      = "system_prompt"
	// 以下为 v1.1 升级新增上下文键（智能路由 / 多 Key / 虚拟模型）
	VirtualModelName  = "virtual_model_name"  // 请求命中的虚拟模型名（F-005）
	SelectedChannelKeyId = "selected_channel_key_id" // 本次请求选中的渠道 Key ID（F-006）
	SelectedChannelKeyName = "selected_channel_key_name"
)
