package monitor

import (
	"time"

	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/model"
)

// F-012 渠道健康诊断：基于探测记录、熔断器状态与响应时间计算 0-100 健康分并持久化。

// ComputeHealthScore 评分 = 0.6*成功率 + 0.25*延迟分 + 0.15*熔断分。
func ComputeHealthScore(channelId int, probes []*model.ChannelProbeLog, responseTime int64, threshold float64) int {
	if len(probes) == 0 {
		base := 70
		if GetCircuitState(channelId) != CircuitClosed {
			base = 20
		}
		return base
	}
	successCount := 0
	var totalLatency int64
	var latencySamples int64
	for _, p := range probes {
		if p.Success {
			successCount++
			if p.LatencyMs > 0 {
				totalLatency += p.LatencyMs
				latencySamples++
			}
		}
	}
	successRate := float64(successCount) / float64(len(probes))
	successScore := successRate * 100

	// 延迟分：阈值内线性给分，超过阈值趋零。threshold 单位为秒，0 时默认 10s。
	latencyScore := 100.0
	thresholdMs := 10000.0
	if threshold > 0 {
		thresholdMs = threshold * 1000
	}
	refLatency := responseTime
	if latencySamples > 0 {
		refLatency = totalLatency / latencySamples
	}
	if refLatency > 0 {
		if float64(refLatency) >= thresholdMs {
			latencyScore = 0
		} else {
			latencyScore = 100.0 * (1.0 - float64(refLatency)/thresholdMs)
		}
	}

	circuitScore := 100.0
	switch GetCircuitState(channelId) {
	case CircuitOpen:
		circuitScore = 0
	case CircuitHalfOpen:
		circuitScore = 50
	}

	score := 0.6*successScore + 0.25*latencyScore + 0.15*circuitScore
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	return int(score)
}

// UpdateChannelHealthScore 计算并持久化渠道健康分与最近探测时间。
func UpdateChannelHealthScore(channelId int) int {
	ch, err := model.GetChannelById(channelId, false)
	if err != nil {
		return 0
	}
	probes, _ := model.GetRecentProbes(channelId, 20)
	score := ComputeHealthScore(channelId, probes, int64(ch.ResponseTime), config.ChannelDisableThreshold)
	model.DB.Model(&model.Channel{}).Where("id = ?", channelId).Updates(map[string]any{
		"health_score":  score,
		"last_probe_at": time.Now().Unix(),
	})
	return score
}
