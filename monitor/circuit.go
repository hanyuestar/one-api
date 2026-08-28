package monitor

import (
	"sync"
	"time"

	"github.com/songquanpeng/one-api/common/config"
)

// F-004 智能路由：渠道熔断器。
// 三态机：CLOSED（正常放行）→ OPEN（错误率/连续失败超阈值，跳过）→ HALF_OPEN（冷却后放行探针）→ CLOSED。
// 与现有 monitor/metric.go 的滑动窗口自动禁用互补：metric 走"自动禁用渠道（持久化）"，
// circuit 走"内存级快速熔断（秒级恢复）"，不写库、不发通知，仅影响路由选择。

type CircuitState int

const (
	CircuitClosed CircuitState = iota
	CircuitOpen
	CircuitHalfOpen
)

func (s CircuitState) String() string {
	switch s {
	case CircuitOpen:
		return "open"
	case CircuitHalfOpen:
		return "half_open"
	default:
		return "closed"
	}
}

type channelCircuit struct {
	mu        sync.Mutex
	state     CircuitState
	failures  int
	successes int
	openedAt  time.Time
	lastFail  time.Time
}

var circuitStore sync.Map // channelId(int) -> *channelCircuit

func getCircuit(id int) *channelCircuit {
	actual, _ := circuitStore.LoadOrStore(id, &channelCircuit{state: CircuitClosed})
	return actual.(*channelCircuit)
}

// AllowChannel 判断该渠道当前是否可接收流量。OPEN 状态冷却结束后转入 HALF_OPEN 并放行一次探针。
// 总开关 CircuitEnable 关闭时恒放行（熔断功能整体禁用）。
func AllowChannel(id int) bool {
	if !config.CircuitEnable {
		return true
	}
	c := getCircuit(id)
	c.mu.Lock()
	defer c.mu.Unlock()
	switch c.state {
	case CircuitClosed:
		return true
	case CircuitOpen:
		cooldown := time.Duration(config.CircuitCooldownSeconds) * time.Second
		if cooldown < 0 {
			cooldown = 30 * time.Second
		}
		if time.Since(c.openedAt) >= cooldown {
			c.state = CircuitHalfOpen
			c.successes = 0
			return true
		}
		return false
	case CircuitHalfOpen:
		// 探针请求进行中：为避免大量请求同时涌入，HALF_OPEN 只放行一个，其余暂时拒绝
		return false
	}
	return true
}

// RecordChannelResult 记录一次请求结果。success=false 且 retryable=true 计入失败；
// success=true 在 HALF_OPEN 下累计成功数，达到阈值后恢复 CLOSED。
func RecordChannelResult(id int, success bool, retryable bool) {
	if !config.CircuitEnable {
		return
	}
	c := getCircuit(id)
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	if success {
		switch c.state {
		case CircuitHalfOpen:
			c.successes++
			need := config.CircuitHalfOpenSuccesses
			if need <= 0 {
				need = 1
			}
			if c.successes >= need {
				c.state = CircuitClosed
				c.failures = 0
			}
		case CircuitClosed:
			// 成功时衰减失败计数（连续成功可逐步恢复健康度）
			if c.failures > 0 {
				c.failures--
			}
		}
		return
	}
	if !retryable {
		// 不可重试错误（如 4xx 业务错误）不熔断渠道
		return
	}
	// 窗口外的失败计数清零（需在覆盖 lastFail 前判断）
	window := time.Duration(config.CircuitWindowSeconds) * time.Second
	if window <= 0 {
		window = 60 * time.Second
	}
	if c.state == CircuitClosed && (c.lastFail.IsZero() || now.Sub(c.lastFail) > window) {
		c.failures = 0
	}
	c.lastFail = now
	c.failures++
	threshold := config.CircuitFailureThreshold
	if threshold <= 0 {
		threshold = 5
	}
	if c.state == CircuitHalfOpen {
		// 探针失败，立即重新 OPEN
		c.state = CircuitOpen
		c.openedAt = now
		c.successes = 0
		return
	}
	if c.failures >= threshold {
		c.state = CircuitOpen
		c.openedAt = now
	}
}

// GetCircuitState 返回渠道当前熔断状态。
func GetCircuitState(id int) CircuitState {
	c := getCircuit(id)
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.state
}

// GetCircuitSnapshot 返回熔断器快照（供健康看板/指标使用）。
type CircuitSnapshot struct {
	State     string `json:"state"`
	Failures  int    `json:"failures"`
	Successes int    `json:"successes"`
	OpenedAt  int64  `json:"opened_at"`
}

func GetCircuitSnapshot(id int) CircuitSnapshot {
	c := getCircuit(id)
	c.mu.Lock()
	defer c.mu.Unlock()
	return CircuitSnapshot{
		State:     c.state.String(),
		Failures:  c.failures,
		Successes: c.successes,
		OpenedAt:  c.openedAt.Unix(),
	}
}

// ResetCircuit 手动重置熔断器（管理后台"恢复"按钮/测试成功后调用）。
func ResetCircuit(id int) {
	c := getCircuit(id)
	c.mu.Lock()
	defer c.mu.Unlock()
	c.state = CircuitClosed
	c.failures = 0
	c.successes = 0
}
