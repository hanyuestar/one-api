package monitor

import (
	"testing"

	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/model"
)

func TestComputeHealthScore_NoProbes(t *testing.T) {
	id := 9101
	ResetCircuit(id)
	if score := ComputeHealthScore(id, nil, 100, 0); score < 50 {
		t.Fatalf("no-probe score should be neutral, got %d", score)
	}
}

func TestComputeHealthScore_AllSuccess(t *testing.T) {
	id := 9102
	ResetCircuit(id)
	probes := make([]*model.ChannelProbeLog, 5)
	for i := range probes {
		probes[i] = &model.ChannelProbeLog{Success: true, LatencyMs: 200}
	}
	if score := ComputeHealthScore(id, probes, 200, 0); score < 85 {
		t.Fatalf("all-success fast score should be high, got %d", score)
	}
}

func TestComputeHealthScore_AllFailuresOpenCircuit(t *testing.T) {
	id := 9103
	config.CircuitFailureThreshold = 3
	ResetCircuit(id)
	for i := 0; i < 3; i++ {
		RecordChannelResult(id, false, true)
	}
	probes := make([]*model.ChannelProbeLog, 5)
	for i := range probes {
		probes[i] = &model.ChannelProbeLog{Success: false, LatencyMs: 0}
	}
	if score := ComputeHealthScore(id, probes, 0, 0); score > 30 {
		t.Fatalf("all-failure open-circuit score should be low, got %d", score)
	}
}

func TestComputeHealthScore_SlowLatencyPenalty(t *testing.T) {
	id := 9104
	ResetCircuit(id)
	// 全部成功但延迟超阈值：延迟分=0，分数应明显低于快速成功的分数
	probes := []*model.ChannelProbeLog{{Success: true, LatencyMs: 15000}}
	score := ComputeHealthScore(id, probes, 15000, 10)
	if score >= 85 {
		t.Fatalf("slow latency should reduce score below fast-success baseline, got %d", score)
	}
	// 快速成功分数应较高
	fastScore := ComputeHealthScore(id, []*model.ChannelProbeLog{{Success: true, LatencyMs: 100}}, 100, 10)
	if fastScore <= score {
		t.Fatalf("fast score %d should exceed slow score %d", fastScore, score)
	}
}
