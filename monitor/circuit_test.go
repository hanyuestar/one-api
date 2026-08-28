package monitor

import (
	"sync"
	"testing"
	"time"

	"github.com/songquanpeng/one-api/common/config"
)
func resetCircuit(id int) {
	c, _ := circuitStore.LoadOrStore(id, &channelCircuit{})
	cc := c.(*channelCircuit)
	cc.mu.Lock()
	cc.state = CircuitClosed
	cc.failures = 0
	cc.successes = 0
	cc.mu.Unlock()
}

func TestCircuitBreaker_OpensAfterThreshold(t *testing.T) {
	config.CircuitFailureThreshold = 3
	config.CircuitCooldownSeconds = 10
	config.CircuitHalfOpenSuccesses = 1
	config.CircuitWindowSeconds = 60
	id := 9001
	resetCircuit(id)

	for i := 0; i < 3; i++ {
		if !AllowChannel(id) {
			t.Fatalf("attempt %d: should allow before opening", i)
		}
		RecordChannelResult(id, false, true) // retryable failure
	}
	if AllowChannel(id) {
		t.Fatal("circuit should be open after threshold failures")
	}
	if GetCircuitState(id) != CircuitOpen {
		t.Fatalf("state = %v, want open", GetCircuitState(id))
	}
}

func TestCircuitBreaker_NonRetryableDoesNotOpen(t *testing.T) {
	config.CircuitFailureThreshold = 2
	id := 9002
	resetCircuit(id)
	for i := 0; i < 10; i++ {
		RecordChannelResult(id, false, false) // 4xx, not retryable
	}
	if !AllowChannel(id) {
		t.Fatal("non-retryable errors must not open the circuit")
	}
}

func TestCircuitBreaker_HalfOpenRecovery(t *testing.T) {
	config.CircuitFailureThreshold = 2
	config.CircuitCooldownSeconds = 30
	config.CircuitHalfOpenSuccesses = 1
	id := 9003
	resetCircuit(id)

	RecordChannelResult(id, false, true)
	RecordChannelResult(id, false, true)
	if AllowChannel(id) {
		t.Fatal("should be open")
	}
	// 模拟冷却期已过：直接把 openedAt 回拨
	cc := getCircuit(id)
	cc.mu.Lock()
	cc.openedAt = time.Now().Add(-time.Minute)
	cc.mu.Unlock()
	if !AllowChannel(id) {
		t.Fatal("should allow probe in half-open after cooldown")
	}
	if GetCircuitState(id) != CircuitHalfOpen {
		t.Fatalf("state = %v, want half_open", GetCircuitState(id))
	}
	// probe succeeds → closed
	RecordChannelResult(id, true, true)
	if GetCircuitState(id) != CircuitClosed {
		t.Fatalf("state = %v, want closed after successful probe", GetCircuitState(id))
	}
}

func TestCircuitBreaker_HalfOpenFailureReopens(t *testing.T) {
	config.CircuitFailureThreshold = 1
	config.CircuitCooldownSeconds = 0
	id := 9004
	resetCircuit(id)
	RecordChannelResult(id, false, true)
	AllowChannel(id) // → half-open
	RecordChannelResult(id, false, true)
	if GetCircuitState(id) != CircuitOpen {
		t.Fatalf("state = %v, want open after failed probe", GetCircuitState(id))
	}
}

func TestCircuitBreaker_Reset(t *testing.T) {
	id := 9005
	resetCircuit(id)
	config.CircuitFailureThreshold = 1
	RecordChannelResult(id, false, true)
	ResetCircuit(id)
	if !AllowChannel(id) {
		t.Fatal("reset should close circuit")
	}
}

func TestCircuitBreaker_ConcurrentSafe(t *testing.T) {
	id := 9006
	resetCircuit(id)
	config.CircuitFailureThreshold = 100
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(2)
		go func() { defer wg.Done(); AllowChannel(id) }()
		go func() { defer wg.Done(); RecordChannelResult(id, true, true) }()
	}
	wg.Wait()
	// no race detector failure implies success
	_ = time.Now
}
