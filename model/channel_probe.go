package model

import (
	"time"
)

// F-012 渠道健康诊断：探测日志持久化。健康分计算位于 monitor 包（避免 model↔monitor 循环依赖）。

type ChannelProbeLog struct {
	Id           int64  `json:"id" gorm:"primaryKey"`
	ChannelId    int    `json:"channel_id" gorm:"index:idx_channel_created"`
	Model        string `json:"model" gorm:"size:64;default:''"`
	Success      bool   `json:"success"`
	LatencyMs    int64  `json:"latency_ms"`
	TtftMs       int64  `json:"ttft_ms"`
	ErrorClass   string `json:"error_class" gorm:"size:32;default:''"`
	ErrorMessage string `json:"error_message" gorm:"type:text;default:''"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;index:idx_channel_created"`
}

func (ChannelProbeLog) TableName() string { return "channel_probe_logs" }

func RecordProbe(log *ChannelProbeLog) error {
	if log.CreatedAt == 0 {
		log.CreatedAt = time.Now().Unix()
	}
	return DB.Create(log).Error
}

// GetRecentProbes 返回渠道最近 N 条探测日志（按时间倒序）。
func GetRecentProbes(channelId int, limit int) ([]*ChannelProbeLog, error) {
	if limit <= 0 {
		limit = 20
	}
	var logs []*ChannelProbeLog
	err := DB.Where("channel_id = ?", channelId).Order("id desc").Limit(limit).Find(&logs).Error
	return logs, err
}
