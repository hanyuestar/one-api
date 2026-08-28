package model

import "testing"

func TestParseFallbackOrder(t *testing.T) {
	cases := []struct {
		in   string
		want []int
	}{
		{"", nil},
		{"  ", nil},
		{"1,2,3", []int{1, 2, 3}},
		{"1, 2 , 3,2", []int{1, 2, 3}},   // 去重 + 空格
		{"1,a,3", []int{1, 3}},           // 非数字跳过
		{"0,1,2", []int{1, 2}},           // 0 跳过
		{"100,200", []int{100, 200}},     // 多位数
	}
	for _, c := range cases {
		got := ParseFallbackOrder(c.in)
		if len(got) != len(c.want) {
			t.Errorf("ParseFallbackOrder(%q) = %v, want %v", c.in, got, c.want)
			continue
		}
		for i := range got {
			if got[i] != c.want[i] {
				t.Errorf("ParseFallbackOrder(%q) = %v, want %v", c.in, got, c.want)
				break
			}
		}
	}
}

func TestRoutingPolicy_WildcardPrecedence(t *testing.T) {
	// 直接操作缓存（同包测试）
	routingPolicyCacheMu.Lock()
	routingPolicyCache = map[string]*RoutingPolicy{
		routingPolicyKey("default", "gpt-4"): {Group: "default", Model: "gpt-4", Strategy: RoutingStrategyWeighted},
		routingPolicyKey("default", "*"):     {Group: "default", Model: "*", Strategy: RoutingStrategyLatency},
		routingPolicyKey("*", "gpt-4"):       {Group: "*", Model: "gpt-4", Strategy: RoutingStrategyRandom},
		routingPolicyKey("*", "*"):           {Group: "*", Model: "*", Strategy: RoutingStrategyPriority},
	}
	routingPolicyCacheMu.Unlock()

	if p := GetRoutingPolicy("default", "gpt-4"); p.Strategy != RoutingStrategyWeighted {
		t.Errorf("exact match failed: %s", p.Strategy)
	}
	if p := GetRoutingPolicy("default", "gpt-3.5"); p.Strategy != RoutingStrategyLatency {
		t.Errorf("group wildcard failed: %s", p.Strategy)
	}
	if p := GetRoutingPolicy("vip", "gpt-4"); p.Strategy != RoutingStrategyRandom {
		t.Errorf("model wildcard failed: %s", p.Strategy)
	}
	if p := GetRoutingPolicy("vip", "claude"); p.Strategy != RoutingStrategyPriority {
		t.Errorf("global wildcard failed: %s", p.Strategy)
	}
	if GetRoutingPolicy("unknown", "x") == nil {
		// 有 *+* 兜底，不应为 nil
		t.Error("global wildcard should match anything")
	}

	// 空缓存 → nil + 默认 priority
	routingPolicyCacheMu.Lock()
	routingPolicyCache = map[string]*RoutingPolicy{}
	routingPolicyCacheMu.Unlock()
	if GetRoutingPolicy("a", "b") != nil {
		t.Error("empty cache should return nil")
	}
	if GetEffectiveStrategy("a", "b") != RoutingStrategyPriority {
		t.Error("default strategy should be priority")
	}
}
