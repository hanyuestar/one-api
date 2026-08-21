package model

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/songquanpeng/one-api/common"
	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/helper"
	"github.com/songquanpeng/one-api/common/logger"
)

type Log struct {
	Id                int    `json:"id"`
	UserId            int    `json:"user_id" gorm:"index"`
	CreatedAt         int64  `json:"created_at" gorm:"bigint;index:idx_created_at_type"`
	Type              int    `json:"type" gorm:"index:idx_created_at_type"`
	Content           string `json:"content"`
	Username          string `json:"username" gorm:"index:index_username_model_name,priority:2;default:''"`
	TokenName         string `json:"token_name" gorm:"index;default:''"`
	ModelName         string `json:"model_name" gorm:"index;index:index_username_model_name,priority:1;default:''"`
	Quota             int    `json:"quota" gorm:"default:0"`
	PromptTokens      int    `json:"prompt_tokens" gorm:"default:0"`
	CompletionTokens  int    `json:"completion_tokens" gorm:"default:0"`
	CacheHitTokens    int    `json:"cache_hit_tokens" gorm:"default:0"`
	CacheWriteTokens  int    `json:"cache_write_tokens" gorm:"default:0"`
	ChannelId         int    `json:"channel" gorm:"index"`
	RequestId         string `json:"request_id" gorm:"default:''"`
	Group             string `json:"group" gorm:"index;default:''"`
	Ip                string `json:"ip" gorm:"default:''"`
	ElapsedTime       int64  `json:"elapsed_time" gorm:"default:0"` // unit is ms
	// 首字延迟(ms)。仅当「流式请求」且「确实收到首个非空内容 token」时 > 0；否则恒为 0（非流式 / 纯工具调用 / 出错透传均无首字语义）
	FirstTokenTime    int64  `json:"first_token_time" gorm:"default:0"`
	IsStream          bool   `json:"is_stream" gorm:"default:false"`
	SystemPromptReset bool   `json:"system_prompt_reset" gorm:"default:false"`
	// 计费明细（结构化 JSON，用于公式反查与前端展示），见 BillingDetail
	BillingDetail string `json:"billing_detail" gorm:"type:text;default:''"`
}

// BillingDetail 计费明细（结构化，用于公式反查与前端展示）。所有比率即 postConsumeQuota 实际使用值。
type BillingDetail struct {
	Model            string  `json:"model"`
	ModelRatio      float64 `json:"model_ratio"`
	GroupRatio      float64 `json:"group_ratio"`
	CompletionRatio float64 `json:"completion_ratio"`
	CacheHitRatio   float64 `json:"cache_hit_ratio"`
	CacheWriteRatio float64 `json:"cache_write_ratio"`
	ChannelType     int     `json:"channel_type"`     // 辅助反查差异时定位渠道比率问题
	PromptTokens    int     `json:"prompt_tokens"`    // 上游原始输入 token
	CompletionTokens int    `json:"completion_tokens"` // 上游原始输出 token
	CacheHitTokens   int    `json:"cache_hit_tokens"`  // 上游原始缓存命中（展示用）
	CacheWriteTokens int    `json:"cache_write_tokens"` // 上游原始缓存写入（展示用）
	BillingCacheHit  int    `json:"billing_cache_hit"`   // 实际计入计费的缓存命中（已钳制）
	BillingCacheWrite int   `json:"billing_cache_write"` // 实际计入计费的缓存写入（已钳制）
	NormalPrompt     int    `json:"normal_prompt"`       // = PromptTokens - BillingCacheHit - BillingCacheWrite
	Quota            int    `json:"quota"`
}

const (
	LogTypeUnknown = iota
	LogTypeTopup
	LogTypeConsume
	LogTypeManage
	LogTypeSystem
	LogTypeTest
)

func recordLogHelper(ctx context.Context, log *Log) {
	requestId := helper.GetRequestID(ctx)
	log.RequestId = requestId
	err := LOG_DB.Create(log).Error
	if err != nil {
		logger.Error(ctx, "failed to record log: "+err.Error())
		return
	}
	logger.Infof(ctx, "record log: %+v", log)
}

func RecordLog(ctx context.Context, userId int, logType int, content string) {
	if logType == LogTypeConsume && !config.LogConsumeEnabled {
		return
	}
	log := &Log{
		UserId:    userId,
		Username:  GetUsernameById(userId),
		CreatedAt: helper.GetTimestamp(),
		Type:      logType,
		Content:   content,
	}
	recordLogHelper(ctx, log)
}

func RecordTopupLog(ctx context.Context, userId int, content string, quota int) {
	log := &Log{
		UserId:    userId,
		Username:  GetUsernameById(userId),
		CreatedAt: helper.GetTimestamp(),
		Type:      LogTypeTopup,
		Content:   content,
		Quota:     quota,
	}
	recordLogHelper(ctx, log)
}

func RecordConsumeLog(ctx context.Context, log *Log) {
	if !config.LogConsumeEnabled {
		return
	}
	log.Username = GetUsernameById(log.UserId)
	log.CreatedAt = helper.GetTimestamp()
	log.Type = LogTypeConsume
	recordLogHelper(ctx, log)
}

func RecordTestLog(ctx context.Context, log *Log) {
	log.CreatedAt = helper.GetTimestamp()
	log.Type = LogTypeTest
	recordLogHelper(ctx, log)
}

func GetAllLogs(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, startIdx int, num int, channel int) (logs []*Log, err error) {
	var tx *gorm.DB
	if logType == LogTypeUnknown {
		tx = LOG_DB
	} else {
		tx = LOG_DB.Where("type = ?", logType)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
	}
	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&logs).Error
	return logs, err
}

func GetUserLogs(userId int, logType int, startTimestamp int64, endTimestamp int64, modelName string, tokenName string, startIdx int, num int) (logs []*Log, err error) {
	var tx *gorm.DB
	if logType == LogTypeUnknown {
		tx = LOG_DB.Where("user_id = ?", userId)
	} else {
		tx = LOG_DB.Where("user_id = ? and type = ?", userId, logType)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	err = tx.Order("id desc").Limit(num).Offset(startIdx).Omit("id").Find(&logs).Error
	return logs, err
}

func SearchAllLogs(keyword string) (logs []*Log, err error) {
	err = LOG_DB.Where("type = ? or content LIKE ?", keyword, keyword+"%").Order("id desc").Limit(config.MaxRecentItems).Find(&logs).Error
	return logs, err
}

func SearchUserLogs(userId int, keyword string) (logs []*Log, err error) {
	err = LOG_DB.Where("user_id = ? and type = ?", userId, keyword).Order("id desc").Limit(config.MaxRecentItems).Omit("id").Find(&logs).Error
	return logs, err
}

func SumUsedQuota(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, channel int) (quota int64) {
	if logType <= 0 {
		logType = LogTypeConsume
	}
	ifnull := "ifnull"
	if common.UsingPostgreSQL {
		ifnull = "COALESCE"
	}
	tx := LOG_DB.Table("logs").Select(fmt.Sprintf("%s(sum(quota),0)", ifnull))
	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
	}
	tx.Where("type = ?", logType).Scan(&quota)
	return quota
}

func SumUsedToken(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, channel int) (token int) {
	if logType <= 0 {
		logType = LogTypeConsume
	}
	ifnull := "ifnull"
	if common.UsingPostgreSQL {
		ifnull = "COALESCE"
	}
	tx := LOG_DB.Table("logs").Select(fmt.Sprintf("%s(sum(prompt_tokens),0) + %s(sum(completion_tokens),0)", ifnull, ifnull))
	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
	}
	tx.Where("type = ?", logType).Scan(&token)
	return token
}

func CountConsumeLogs(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, channel int) (count int64) {
	if logType <= 0 {
		logType = LogTypeConsume
	}
	tx := LOG_DB.Model(&Log{}).Where("type = ?", logType)
	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
	}
	tx.Count(&count)
	return count
}

func DeleteOldLog(targetTimestamp int64) (int64, error) {
	result := LOG_DB.Where("created_at < ?", targetTimestamp).Delete(&Log{})
	return result.RowsAffected, result.Error
}

type LogStatistic struct {
	Day              string `gorm:"column:day"`
	ModelName        string `gorm:"column:model_name"`
	RequestCount     int    `gorm:"column:request_count"`
	Quota            int    `gorm:"column:quota"`
	PromptTokens     int    `gorm:"column:prompt_tokens"`
	CompletionTokens int    `gorm:"column:completion_tokens"`
}

func SearchLogsByDayAndModel(userId, start, end int) (LogStatistics []*LogStatistic, err error) {
	groupSelect := "DATE_FORMAT(FROM_UNIXTIME(created_at), '%Y-%m-%d') as day"

	if common.UsingPostgreSQL {
		groupSelect = "TO_CHAR(date_trunc('day', to_timestamp(created_at)), 'YYYY-MM-DD') as day"
	}

	if common.UsingSQLite {
		groupSelect = "strftime('%Y-%m-%d', datetime(created_at, 'unixepoch')) as day"
	}

	err = LOG_DB.Raw(`
		SELECT `+groupSelect+`,
		model_name, count(1) as request_count,
		sum(quota) as quota,
		sum(prompt_tokens) as prompt_tokens,
		sum(completion_tokens) as completion_tokens
		FROM logs
		WHERE type=2
		AND user_id= ?
		AND created_at BETWEEN ? AND ?
		GROUP BY day, model_name
		ORDER BY day, model_name
	`, userId, start, end).Scan(&LogStatistics).Error

	return LogStatistics, err
}

// ModelAnalysisRow 按模型聚合的分析行（支撑 C3 模型分析看板）
type ModelAnalysisRow struct {
	ModelName         string `gorm:"column:model_name" json:"model_name"`
	RequestCount      int64  `gorm:"column:request_count" json:"request_count"`
	Quota             int64  `gorm:"column:quota" json:"quota"`
	PromptTokens      int64  `gorm:"column:prompt_tokens" json:"prompt_tokens"`
	CompletionTokens  int64  `gorm:"column:completion_tokens" json:"completion_tokens"`
	AvgFirstTokenTime int64  `gorm:"column:avg_first_token_time" json:"avg_first_token_time"` // ms，仅对 first_token_time>0 求均
	AvgElapsedTime    int64  `gorm:"column:avg_elapsed_time" json:"avg_elapsed_time"`         // ms
}

// avgExprFor 返回跨库兼容的 AVG 表达式，统一四舍五入取整（PG ::bigint、MySQL/SQLite ROUND 后 CAST）。
func avgExprFor(colExpr string) string {
	if common.UsingPostgreSQL {
		return colExpr + "::bigint"
	}
	if common.UsingSQLite {
		return "CAST(ROUND(" + colExpr + ") AS INTEGER)"
	}
	return "CAST(ROUND(" + colExpr + ") AS SIGNED)" // MySQL
}

// SearchLogsByModel 按模型聚合消费日志（请求数/额度/token/平均首字延迟/平均耗时）。
// logType 形参与 SumUsedQuota 同款：形参保留（接口形状与 stat 系列一致），内部固定 LogTypeConsume（type=2）。
func SearchLogsByModel(logType int, startTimestamp, endTimestamp int64, modelName, username, tokenName string, channel int) (rows []*ModelAnalysisRow, err error) {
	if logType <= 0 {
		logType = LogTypeConsume
	}
	tx := LOG_DB.Model(&Log{}).Where("type = ?", logType)
	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
	}
	avgTTFT := avgExprFor("AVG(CASE WHEN first_token_time > 0 THEN first_token_time END)")
	avgElapsed := avgExprFor("AVG(elapsed_time)")
	err = tx.Select("model_name, count(1) as request_count, sum(quota) as quota, " +
		"sum(prompt_tokens) as prompt_tokens, sum(completion_tokens) as completion_tokens, " +
		avgTTFT + " as avg_first_token_time, " + avgElapsed + " as avg_elapsed_time").
		Group("model_name").Order("request_count desc").
		Scan(&rows).Error
	return
}

// AvgFirstTokenTime 全局平均首字延迟(ms)，仅对 first_token_time>0 的记录求均（非流式/未触发首字不计入）。
// 无首字记录时 COALESCE/IFNULL 兜底为 0。过滤条件与 SumUsedQuota 系列一致。
func AvgFirstTokenTime(logType int, startTimestamp, endTimestamp int64, modelName, username, tokenName string, channel int) (avg int64) {
	if logType <= 0 {
		logType = LogTypeConsume
	}
	ifnull := "ifnull"
	if common.UsingPostgreSQL {
		ifnull = "COALESCE"
	}
	tx := LOG_DB.Model(&Log{}).Where("type = ?", logType)
	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
	}
	avgExpr := avgExprFor("AVG(CASE WHEN first_token_time > 0 THEN first_token_time END)")
	tx.Select(fmt.Sprintf("%s(%s, 0)", ifnull, avgExpr)).Scan(&avg)
	return avg
}
