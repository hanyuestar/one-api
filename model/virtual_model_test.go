package model

import "testing"

func TestPickCandidate_Weighted(t *testing.T) {
	cs := []VirtualCandidate{
		{Model: "a", Weight: 1},
		{Model: "b", Weight: 100},
	}
	counts := map[string]int{}
	for i := 0; i < 200; i++ {
		c := pickCandidate(cs)
		if c != nil {
			counts[c.Model]++
		}
	}
	if counts["b"] <= counts["a"]*10 {
		t.Fatalf("weighted should strongly favor b, got %v", counts)
	}
}

func TestPickCandidate_Empty(t *testing.T) {
	if pickCandidate(nil) != nil {
		t.Fatal("nil candidates should return nil")
	}
}

func TestResolveVirtualModel(t *testing.T) {
	virtualModelCacheMu.Lock()
	virtualModelCache = map[string]*VirtualModel{
		"pool": {
			Name:    "pool",
			Enabled: true,
			Config:  `{"candidates":[{"model":"gpt-4o","channel_id":0,"weight":1},{"model":"gpt-4o-mini","channel_id":7,"weight":1}]}`,
		},
		"disabled": {Name: "disabled", Enabled: false, Config: `{"candidates":[{"model":"x","weight":1}]}`},
		"bad":      {Name: "bad", Enabled: true, Config: `not-json`},
	}
	virtualModelCacheMu.Unlock()

	// 普通模型透传
	if m, vn, cid := ResolveVirtualModel("default", "gpt-4"); m != "gpt-4" || vn != "" || cid != 0 {
		t.Fatalf("passthrough failed: %s %s %d", m, vn, cid)
	}
	// 虚拟模型命中
	gotModels := map[string]bool{}
	gotCid := false
	for i := 0; i < 100; i++ {
		m, vn, cid := ResolveVirtualModel("default", "pool")
		if vn != "pool" {
			t.Fatalf("virtual name mismatch: %q", vn)
		}
		gotModels[m] = true
		if cid == 7 {
			gotCid = true
		}
	}
	if !gotModels["gpt-4o"] || !gotModels["gpt-4o-mini"] {
		t.Fatalf("expected both candidates, got %v", gotModels)
	}
	if !gotCid {
		t.Fatal("expected pinned channel_id=7 candidate to be selectable")
	}
	// 禁用的虚拟模型透传
	if _, vn, _ := ResolveVirtualModel("default", "disabled"); vn != "" {
		t.Fatal("disabled virtual model should passthrough")
	}
	// 坏配置透传
	if m, _, _ := ResolveVirtualModel("default", "bad"); m != "bad" {
		t.Fatal("bad config should passthrough")
	}
}

func TestVirtualModel_ParseConfig(t *testing.T) {
	v := &VirtualModel{Config: ""}
	cfg, err := v.ParseConfig()
	if err != nil || len(cfg.Candidates) != 0 {
		t.Fatal("empty config should yield empty candidates")
	}
	v2 := &VirtualModel{Config: `{"candidates":[{"model":"a","weight":2}]}`}
	cfg2, err := v2.ParseConfig()
	if err != nil || cfg2.Candidates[0].Model != "a" {
		t.Fatalf("parse failed: %v %+v", err, cfg2)
	}
}
