package routing

import (
	"testing"

	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/model"
	"github.com/songquanpeng/one-api/monitor"
)

func makeCh(id int, priority int64, weight uint, status int, responseTime int) *model.Channel {
	return &model.Channel{
		Id:           id,
		Priority:     &priority,
		Weight:       &weight,
		Status:       status,
		ResponseTime: responseTime,
	}
}

func TestSelect_PriorityAndWeight(t *testing.T) {
	config.CircuitEnable = false
	// 两个同优先级渠道，权重 1 vs 100 → 应绝大多数选权重高者
	candidates := []*model.Channel{
		makeCh(1, 1, 1, model.ChannelStatusEnabled, 100),
		makeCh(2, 1, 100, model.ChannelStatusEnabled, 100),
	}
	counts := map[int]int{}
	for i := 0; i < 200; i++ {
		ch := Select(candidates, model.RoutingStrategyWeighted, nil)
		if ch != nil {
			counts[ch.Id]++
		}
	}
	if counts[2] <= counts[1]*10 {
		t.Fatalf("weighted should strongly favor channel 2, got %v", counts)
	}
}

func TestSelect_PriorityLayer(t *testing.T) {
	config.CircuitEnable = false
	// 高优先级渠道即使权重低也应优先
	candidates := []*model.Channel{
		makeCh(1, 10, 1, model.ChannelStatusEnabled, 100),
		makeCh(2, 1, 1000, model.ChannelStatusEnabled, 100),
	}
	for i := 0; i < 20; i++ {
		ch := Select(candidates, model.RoutingStrategyPriority, nil)
		if ch == nil || ch.Id != 1 {
			t.Fatalf("expected high-priority channel 1, got %v", ch)
		}
	}
}

func TestSelect_LatencyStrategy(t *testing.T) {
	config.CircuitEnable = false
	candidates := []*model.Channel{
		makeCh(1, 1, 0, model.ChannelStatusEnabled, 5000),
		makeCh(2, 1, 0, model.ChannelStatusEnabled, 100),
	}
	ch := Select(candidates, model.RoutingStrategyLatency, nil)
	if ch == nil || ch.Id != 2 {
		t.Fatalf("latency strategy should pick fastest channel 2, got %v", ch)
	}
}

func TestSelect_RandomStrategy(t *testing.T) {
	config.CircuitEnable = false
	candidates := []*model.Channel{
		makeCh(1, 1, 0, model.ChannelStatusEnabled, 100),
		makeCh(2, 1, 0, model.ChannelStatusEnabled, 100),
	}
	seen := map[int]bool{}
	for i := 0; i < 100; i++ {
		ch := Select(candidates, model.RoutingStrategyRandom, nil)
		if ch != nil {
			seen[ch.Id] = true
		}
	}
	if len(seen) != 2 {
		t.Fatalf("random should hit both channels, got %v", seen)
	}
}

func TestSelect_SkipsOpenCircuit(t *testing.T) {
	config.CircuitEnable = true
	config.CircuitFailureThreshold = 1
	monitor.ResetCircuit(3001)
	for i := 0; i < 2; i++ {
		monitor.RecordChannelResult(3001, false, true)
	}
	candidates := []*model.Channel{
		makeCh(3001, 1, 0, model.ChannelStatusEnabled, 100),
		makeCh(3002, 1, 0, model.ChannelStatusEnabled, 100),
	}
	ch := Select(candidates, model.RoutingStrategyPriority, nil)
	if ch == nil || ch.Id != 3002 {
		t.Fatalf("should skip open-circuit channel, got %v", ch)
	}
	monitor.ResetCircuit(3001)
}

func TestSelect_ExcludesTriedChannels(t *testing.T) {
	config.CircuitEnable = false
	candidates := []*model.Channel{
		makeCh(1, 1, 0, model.ChannelStatusEnabled, 100),
		makeCh(2, 1, 0, model.ChannelStatusEnabled, 100),
	}
	ch := Select(candidates, model.RoutingStrategyPriority, map[int]bool{1: true})
	if ch == nil || ch.Id != 2 {
		t.Fatalf("should exclude tried channel 1, got %v", ch)
	}
}

func TestSelect_NilWhenNoCandidates(t *testing.T) {
	if Select(nil, model.RoutingStrategyPriority, nil) != nil {
		t.Fatal("nil candidates should return nil")
	}
}

func TestFallbackChain(t *testing.T) {
	config.CircuitEnable = false
	candidates := []*model.Channel{
		makeCh(1, 1, 0, model.ChannelStatusEnabled, 100),
		makeCh(2, 1, 0, model.ChannelStatusEnabled, 100),
		makeCh(3, 1, 0, model.ChannelStatusEnabled, 100),
	}
	anchor := &model.Channel{FallbackOrder: "1,2,3"}
	chain := FallbackChain(anchor, candidates, nil)
	if len(chain) != 3 || chain[0].Id != 1 || chain[1].Id != 2 || chain[2].Id != 3 {
		t.Fatalf("fallback chain order wrong: %+v", chain)
	}
	// 排除已尝试
	chain2 := FallbackChain(anchor, candidates, map[int]bool{1: true})
	if len(chain2) != 2 || chain2[0].Id != 2 {
		t.Fatalf("excluded chain wrong: %+v", chain2)
	}
	// 无 fallback_order 返回 nil
	if FallbackChain(&model.Channel{}, candidates, nil) != nil {
		t.Fatal("empty fallback order should return nil")
	}
}
