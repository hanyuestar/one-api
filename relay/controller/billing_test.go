package controller

import (
	"testing"

	"github.com/songquanpeng/one-api/model"
)

func TestVerifyBillingDetail_NoReasoning(t *testing.T) {
	// 100 prompt + 50 completion, completionRatio=2, modelRatio=1, groupRatio=1
	// raw = (100 + 50*2) * 1 * 1 = 200
	d := model.BillingDetail{
		PromptTokens:     100,
		CompletionTokens: 50,
		NormalPrompt:     100,
		CompletionRatio:  2,
		ModelRatio:       1,
		GroupRatio:       1,
		Quota:            200,
	}
	got, ok := VerifyBillingDetail(d)
	if !ok || got != 200 {
		t.Fatalf("got %d ok=%v, want 200 true", got, ok)
	}
}

func TestVerifyBillingDetail_WithReasoning(t *testing.T) {
	// 100 prompt + 100 completion（其中 80 是 reasoning）
	// completionRatio=2, reasoningRatio=4, modelRatio=1, groupRatio=1
	// raw = (100 + (100-80)*2 + 80*4) * 1 = 100 + 40 + 320 = 460
	d := model.BillingDetail{
		PromptTokens:     100,
		CompletionTokens: 100,
		ReasoningTokens:  80,
		NormalPrompt:     100,
		CompletionRatio:  2,
		ReasoningRatio:   4,
		ModelRatio:       1,
		GroupRatio:       1,
		Quota:            460,
	}
	got, ok := VerifyBillingDetail(d)
	if !ok || got != 460 {
		t.Fatalf("got %d ok=%v, want 460 true", got, ok)
	}
}

func TestVerifyBillingDetail_ReasoningFallsBackToCompletionRatio(t *testing.T) {
	// 未配置 reasoningRatio（=0）→ 回退 completionRatio，与历史口径一致
	// 100 prompt + 50 completion（含 20 reasoning），completionRatio=2
	// raw = (100 + 30*2 + 20*2) = 200
	d := model.BillingDetail{
		PromptTokens:     100,
		CompletionTokens: 50,
		ReasoningTokens:  20,
		NormalPrompt:     100,
		CompletionRatio:  2,
		ReasoningRatio:   0,
		ModelRatio:       1,
		GroupRatio:       1,
		Quota:            200,
	}
	got, ok := VerifyBillingDetail(d)
	if !ok || got != 200 {
		t.Fatalf("got %d ok=%v, want 200 true", got, ok)
	}
}

func TestVerifyBillingDetail_CacheTokens(t *testing.T) {
	// 100 prompt（其中 40 cache hit ratio 0.5, 20 cache write ratio 1.25）
	// 50 completion ratio 2
	// raw = (40 + 40*0.5 + 20*1.25 + 50*2) = 40+20+25+100 = 185
	d := model.BillingDetail{
		PromptTokens:      100,
		CompletionTokens:  50,
		NormalPrompt:      40,
		BillingCacheHit:   40,
		BillingCacheWrite: 20,
		CacheHitRatio:     0.5,
		CacheWriteRatio:   1.25,
		CompletionRatio:   2,
		ModelRatio:        1,
		GroupRatio:        1,
		Quota:             185,
	}
	got, ok := VerifyBillingDetail(d)
	if !ok || got != 185 {
		t.Fatalf("got %d ok=%v, want 185 true", got, ok)
	}
}

func TestVerifyBillingDetail_ZeroTokens(t *testing.T) {
	d := model.BillingDetail{}
	got, ok := VerifyBillingDetail(d)
	if got != 0 || !ok {
		t.Fatalf("zero tokens should yield 0/match, got %d ok=%v", got, ok)
	}
}
