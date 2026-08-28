// Package routing 实现 F-004 智能路由选择：在候选渠道集合上按策略选择，
// 并集成熔断器过滤与 fallback 链。middleware/distributor 与重试逻辑统一调用本包。
package routing

import (
	"math/rand"
	"sort"

	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/model"
	"github.com/songquanpeng/one-api/monitor"
)

// eligible 过滤掉被排除与熔断打开的渠道。
func eligible(channels []*model.Channel, exclude map[int]bool) []*model.Channel {
	out := make([]*model.Channel, 0, len(channels))
	for _, ch := range channels {
		if ch == nil {
			continue
		}
		if exclude != nil && exclude[ch.Id] {
			continue
		}
		if config.CircuitEnable && !monitor.AllowChannel(ch.Id) {
			continue
		}
		out = append(out, ch)
	}
	return out
}

// topPriorityTier 返回优先级最高的那一层候选（channels 已按优先级降序排列时直接截断）。
func topPriorityTier(channels []*model.Channel) []*model.Channel {
	if len(channels) == 0 {
		return channels
	}
	// 防御：若未排序，先排序
	sort.SliceStable(channels, func(i, j int) bool {
		return channels[i].GetPriority() > channels[j].GetPriority()
	})
	top := channels[0].GetPriority()
	end := len(channels)
	for i := 1; i < len(channels); i++ {
		if channels[i].GetPriority() != top {
			end = i
			break
		}
	}
	return channels[:end]
}

func weightedPick(channels []*model.Channel, weightOf func(*model.Channel) float64) *model.Channel {
	if len(channels) == 0 {
		return nil
	}
	if len(channels) == 1 {
		return channels[0]
	}
	weights := make([]float64, len(channels))
	total := 0.0
	for i, ch := range channels {
		w := weightOf(ch)
		if w <= 0 {
			w = 1 // 权重 0 视为等权，避免渠道被完全饿死
		}
		weights[i] = w
		total += w
	}
	r := rand.Float64() * total
	acc := 0.0
	for i, w := range weights {
		acc += w
		if r <= acc {
			return channels[i]
		}
	}
	return channels[len(channels)-1]
}

// Select 在候选渠道中按策略选择一个。strategy 为空或未知时按 priority（历史行为）。
// exclude 为重试时已尝试过的渠道集合。
func Select(channels []*model.Channel, strategy string, exclude map[int]bool) *model.Channel {
	candidates := eligible(channels, exclude)
	if len(candidates) == 0 {
		// 所有候选都被熔断/排除时，退化为忽略熔断再选一次（保证可用性优先）
		fallback := make([]*model.Channel, 0, len(channels))
		for _, ch := range channels {
			if ch != nil && (exclude == nil || !exclude[ch.Id]) {
				fallback = append(fallback, ch)
			}
		}
		if len(fallback) == 0 {
			return nil
		}
		candidates = fallback
	}

	switch strategy {
	case model.RoutingStrategyWeighted:
		return weightedPick(topPriorityTier(candidates), func(ch *model.Channel) float64 {
			return float64(ch.GetWeight())
		})
	case model.RoutingStrategyLatency:
		// 延迟越低权重越高；ResponseTime 为 0（未探测）时按等权处理
		return weightedPick(topPriorityTier(candidates), func(ch *model.Channel) float64 {
			rt := ch.ResponseTime
			if rt <= 0 {
				return 1
			}
			return 1000.0 / float64(rt)
		})
	case model.RoutingStrategyRandom:
		return candidates[rand.Intn(len(candidates))]
	case model.RoutingStrategyPriority, "":
		fallthrough
	default:
		tier := topPriorityTier(candidates)
		return tier[rand.Intn(len(tier))]
	}
}

// FallbackChain 按渠道配置的 fallback_order 返回有序候选（已过滤熔断/排除/可用性）。
// 返回的切片保持 fallback_order 顺序，调用方按序尝试即可。
func FallbackChain(ch *model.Channel, allCandidates []*model.Channel, exclude map[int]bool) []*model.Channel {
	if ch == nil {
		return nil
	}
	order := model.ParseFallbackOrder(ch.FallbackOrder)
	if len(order) == 0 {
		return nil
	}
	byId := make(map[int]*model.Channel, len(allCandidates))
	for _, c := range allCandidates {
		byId[c.Id] = c
	}
	var chain []*model.Channel
	for _, id := range order {
		if exclude != nil && exclude[id] {
			continue
		}
		c, ok := byId[id]
		if !ok || c == nil {
			continue
		}
		if config.CircuitEnable && !monitor.AllowChannel(c.Id) {
			continue
		}
		chain = append(chain, c)
	}
	return chain
}
