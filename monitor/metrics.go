package monitor

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
)

// F-010 可观测性：轻量级 Prometheus 指标（无第三方依赖）。
// 覆盖：请求计数（按渠道/模型/状态/错误类）、token 计数、成本、请求耗时、TTFT、熔断状态。

var (
	metricMu     sync.Mutex
	counterStore = make(map[string]*counterVec)
)

type counterVec struct {
	name   string
	help   string
	labels []string
	values map[string]*uint64 // labelKey -> count
}

func newCounterVec(name, help string, labels ...string) *counterVec {
	cv := &counterVec{
		name:   name,
		help:   help,
		labels: labels,
		values: make(map[string]*uint64),
	}
	metricMu.Lock()
	counterStore[name] = cv
	metricMu.Unlock()
	return cv
}

func (cv *counterVec) inc(labelValues ...string) {
	key := strings.Join(labelValues, "|")
	metricMu.Lock()
	p, ok := cv.values[key]
	if !ok {
		var v uint64
		p = &v
		cv.values[key] = p
	}
	metricMu.Unlock()
	atomic.AddUint64(p, 1)
}

func (cv *counterVec) add(n uint64, labelValues ...string) {
	key := strings.Join(labelValues, "|")
	metricMu.Lock()
	p, ok := cv.values[key]
	if !ok {
		var v uint64
		p = &v
		cv.values[key] = p
	}
	metricMu.Unlock()
	atomic.AddUint64(p, n)
}

// histogram 简易直方图（固定桶 + count/sum）
type histogram struct {
	name   string
	help   string
	labels []string
	buckets []float64
	mu     sync.Mutex
	values map[string]*histogramValue // labelKey -> value
}

type histogramValue struct {
	bucketCounts []uint64
	sum          float64
	count        uint64
}

func newHistogram(name, help string, buckets []float64, labels ...string) *histogram {
	h := &histogram{
		name:    name,
		help:    help,
		labels:  labels,
		buckets: buckets,
		values:  make(map[string]*histogramValue),
	}
	metricMu.Lock()
	histStore[name] = h
	metricMu.Unlock()
	return h
}

var histStore = make(map[string]*histogram)

func (h *histogram) observe(v float64, labelValues ...string) {
	key := strings.Join(labelValues, "|")
	h.mu.Lock()
	hv, ok := h.values[key]
	if !ok {
		hv = &histogramValue{bucketCounts: make([]uint64, len(h.buckets))}
		h.values[key] = hv
	}
	hv.sum += v
	hv.count++
	for i, b := range h.buckets {
		if v <= b {
			hv.bucketCounts[i]++
		}
	}
	h.mu.Unlock()
}

// 指标定义
var (
	requestsTotal = newCounterVec("oneapi_requests_total", "Total number of API requests.", "channel", "model", "status", "error_class")
	tokensTotal   = newCounterVec("oneapi_tokens_total", "Total tokens processed.", "channel", "model", "type")
	costTotal     = newCounterVec("oneapi_cost_total", "Total quota cost.", "channel", "model")
)

var (
	requestDuration = newHistogram("oneapi_request_duration_ms", "Request duration in milliseconds.",
		[]float64{50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000})
	ttftDuration = newHistogram("oneapi_ttft_ms", "Time to first token in milliseconds (stream only).",
		[]float64{50, 100, 200, 500, 1000, 2000, 5000, 10000})
)

// RecordRequest 记录一次请求结果。
func RecordRequest(channelId int, model string, statusCode int, errorClass string) {
	requestsTotal.inc(fmt.Sprintf("%d", channelId), model, fmt.Sprintf("%d", statusCode), errorClass)
}

// RecordTokens 记录 token 用量。
func RecordTokens(channelId int, model string, prompt, completion, cacheHit, cacheWrite, reasoning int) {
	if prompt > 0 {
		tokensTotal.add(uint64(prompt), fmt.Sprintf("%d", channelId), model, "prompt")
	}
	if completion > 0 {
		tokensTotal.add(uint64(completion), fmt.Sprintf("%d", channelId), model, "completion")
	}
	if cacheHit > 0 {
		tokensTotal.add(uint64(cacheHit), fmt.Sprintf("%d", channelId), model, "cache_hit")
	}
	if cacheWrite > 0 {
		tokensTotal.add(uint64(cacheWrite), fmt.Sprintf("%d", channelId), model, "cache_write")
	}
	if reasoning > 0 {
		tokensTotal.add(uint64(reasoning), fmt.Sprintf("%d", channelId), model, "reasoning")
	}
}

// RecordCost 记录成本（quota 单位）。
func RecordCost(channelId int, model string, quota int64) {
	if quota > 0 {
		costTotal.add(uint64(quota), fmt.Sprintf("%d", channelId), model)
	}
}

// ObserveDuration 记录请求耗时（ms）。
func ObserveDuration(ms int64) { requestDuration.observe(float64(ms)) }

// ObserveTTFT 记录首字延迟（ms）。
func ObserveTTFT(ms int64) {
	if ms > 0 {
		ttftDuration.observe(float64(ms))
	}
}

// RenderPrometheus 输出 Prometheus 文本格式。
func RenderPrometheus() string {
	var b strings.Builder

	metricMu.Lock()
	cvNames := make([]string, 0, len(counterStore))
	for n := range counterStore {
		cvNames = append(cvNames, n)
	}
	sort.Strings(cvNames)
	for _, n := range cvNames {
		cv := counterStore[n]
		fmt.Fprintf(&b, "# HELP %s %s\n# TYPE %s counter\n", cv.name, cv.help, cv.name)
		keys := make([]string, 0, len(cv.values))
		for k := range cv.values {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			lvs := strings.Split(k, "|")
			b.WriteString(cv.name)
			b.WriteString("{")
			for i, lv := range lvs {
				if i > 0 {
					b.WriteString(",")
				}
				fmt.Fprintf(&b, `%s="%s"`, cv.labels[i], lv)
			}
			b.WriteString("} ")
			fmt.Fprintf(&b, "%d\n", atomic.LoadUint64(cv.values[k]))
		}
	}

	hNames := make([]string, 0, len(histStore))
	for n := range histStore {
		hNames = append(hNames, n)
	}
	sort.Strings(hNames)
	for _, n := range hNames {
		h := histStore[n]
		fmt.Fprintf(&b, "# HELP %s %s\n# TYPE %s histogram\n", h.name, h.help, h.name)
		keys := make([]string, 0, len(h.values))
		for k := range h.values {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			h.mu.Lock()
			hv := h.values[k]
			var cum uint64
			for i, bk := range h.buckets {
				cum += hv.bucketCounts[i]
				lvs := ""
				if k != "" {
					parts := strings.Split(k, "|")
					pairs := make([]string, 0, len(parts))
					for j, p := range parts {
						pairs = append(pairs, fmt.Sprintf(`%s="%s"`, h.labels[j], p))
					}
					lvs = strings.Join(pairs, ",") + ","
				}
				fmt.Fprintf(&b, "%s_bucket{%sle=\"%g\"} %d\n", h.name, lvs, bk, cum)
			}
			fmt.Fprintf(&b, "%s_bucket{le=\"+Inf\"} %d\n", h.name, hv.count)
			fmt.Fprintf(&b, "%s_sum %g\n", h.name, hv.sum)
			fmt.Fprintf(&b, "%s_count %d\n", h.name, hv.count)
			h.mu.Unlock()
		}
	}
	metricMu.Unlock()

	// 熔断状态 gauge（实时读取）
	b.WriteString("# HELP oneapi_circuit_state Circuit breaker state per channel (0=closed,1=half_open,2=open).\n# TYPE oneapi_circuit_state gauge\n")
	circuitStore.Range(func(key, value any) bool {
		id := key.(int)
		st := GetCircuitState(id)
		b.WriteString(fmt.Sprintf("oneapi_circuit_state{channel=\"%d\"} %d\n", id, int(st)))
		return true
	})
	return b.String()
}
