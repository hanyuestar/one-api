package model

import (
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/songquanpeng/one-api/common/logger"
)

// F-004 智能路由：按 (group, model) 配置路由策略。
// strategy: priority(默认，保持历史行为) | weighted | latency | random
// "*" 作为通配：先精确匹配 group+model，再 group+"*"，再 "*"+model，最后 "*"+"*"。

const (
	RoutingStrategyPriority = "priority"
	RoutingStrategyWeighted = "weighted"
	RoutingStrategyLatency  = "latency"
	RoutingStrategyRandom   = "random"
)

type RoutingPolicy struct {
	Id        int    `json:"id" gorm:"primaryKey"`
	Group     string `json:"group" gorm:"index:idx_group_model,unique;size:64;not null;default:''"`
	Model     string `json:"model" gorm:"index:idx_group_model,unique;size:255;not null;default:''"`
	Strategy  string `json:"strategy" gorm:"size:32;not null;default:'priority'"`
	Config    string `json:"config" gorm:"type:text;default:''"` // 预留：策略参数 JSON
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

func (RoutingPolicy) TableName() string { return "routing_policies" }

var (
	routingPolicyCache   = make(map[string]*RoutingPolicy)
	routingPolicyCacheMu sync.RWMutex
)

func routingPolicyKey(group, model string) string { return group + "\x00" + model }

// GetRoutingPolicy 按通配顺序查找策略；未配置返回 nil（调用方按 priority 默认处理）。
func GetRoutingPolicy(group, model string) *RoutingPolicy {
	routingPolicyCacheMu.RLock()
	defer routingPolicyCacheMu.RUnlock()
	for _, k := range [][2]string{{group, model}, {group, "*"}, {"*", model}, {"*", "*"}} {
		if p, ok := routingPolicyCache[routingPolicyKey(k[0], k[1])]; ok {
			return p
		}
	}
	return nil
}

// GetEffectiveStrategy 返回有效策略名（无配置时为 priority，保持历史行为）。
func GetEffectiveStrategy(group, model string) string {
	p := GetRoutingPolicy(group, model)
	if p == nil || p.Strategy == "" {
		return RoutingStrategyPriority
	}
	return p.Strategy
}

func InitRoutingPolicyCache() {
	policies, err := GetAllRoutingPolicies()
	if err != nil {
		logger.SysError("failed to load routing policies: " + err.Error())
		return
	}
	newCache := make(map[string]*RoutingPolicy, len(policies))
	for _, p := range policies {
		newCache[routingPolicyKey(p.Group, p.Model)] = p
	}
	routingPolicyCacheMu.Lock()
	routingPolicyCache = newCache
	routingPolicyCacheMu.Unlock()
	logger.SysLog("routing policies cached")
}

func GetAllRoutingPolicies() ([]*RoutingPolicy, error) {
	var policies []*RoutingPolicy
	err := DB.Find(&policies).Error
	return policies, err
}

func validateRoutingStrategy(s string) error {
	switch s {
	case RoutingStrategyPriority, RoutingStrategyWeighted, RoutingStrategyLatency, RoutingStrategyRandom:
		return nil
	default:
		return errors.New("invalid strategy: " + s)
	}
}

func (p *RoutingPolicy) Insert() error {
	if p.Group == "" {
		p.Group = "*"
	}
	if p.Model == "" {
		p.Model = "*"
	}
	if p.Strategy == "" {
		p.Strategy = RoutingStrategyPriority
	}
	if err := validateRoutingStrategy(p.Strategy); err != nil {
		return err
	}
	p.CreatedAt = time.Now().Unix()
	p.UpdatedAt = p.CreatedAt
	err := DB.Create(p).Error
	if err == nil {
		InitRoutingPolicyCache()
	}
	return err
}

func (p *RoutingPolicy) Update() error {
	if p.Strategy != "" {
		if err := validateRoutingStrategy(p.Strategy); err != nil {
			return err
		}
	}
	p.UpdatedAt = time.Now().Unix()
	err := DB.Model(p).Updates(map[string]any{
		"strategy":   p.Strategy,
		"config":     p.Config,
		"updated_at": p.UpdatedAt,
	}).Error
	if err == nil {
		InitRoutingPolicyCache()
	}
	return err
}

func DeleteRoutingPolicy(id int) error {
	err := DB.Delete(&RoutingPolicy{}, id).Error
	if err == nil {
		InitRoutingPolicyCache()
	}
	return err
}

// ParseFallbackOrder 解析渠道的 fallback_order 文本（逗号分隔的渠道 ID），返回去重后的有序列表。
func ParseFallbackOrder(s string) []int {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	seen := make(map[int]bool)
	var order []int
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		id := 0
		for _, ch := range p {
			if ch < '0' || ch > '9' {
				id = 0
				break
			}
			id = id*10 + int(ch-'0')
		}
		if id > 0 && !seen[id] {
			seen[id] = true
			order = append(order, id)
		}
	}
	return order
}
