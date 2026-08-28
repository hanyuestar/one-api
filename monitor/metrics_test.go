package monitor

import (
	"strings"
	"testing"
)

func TestMetrics_CountersAndRender(t *testing.T) {
	RecordRequest(1, "gpt-4", 200, "")
	RecordRequest(1, "gpt-4", 200, "")
	RecordRequest(2, "gpt-4", 500, "upstream_5xx")
	RecordTokens(1, "gpt-4", 100, 50, 10, 5, 20)
	RecordCost(1, "gpt-4", 5000)
	ObserveDuration(120)
	ObserveDuration(800)
	ObserveTTFT(150)

	out := RenderPrometheus()
	checks := []string{
		`oneapi_requests_total{channel="1",model="gpt-4",status="200",error_class=""} 2`,
		`oneapi_requests_total{channel="2",model="gpt-4",status="500",error_class="upstream_5xx"} 1`,
		`oneapi_tokens_total{channel="1",model="gpt-4",type="prompt"} 100`,
		`oneapi_tokens_total{channel="1",model="gpt-4",type="reasoning"} 20`,
		`oneapi_cost_total{channel="1",model="gpt-4"} 5000`,
		"# TYPE oneapi_requests_total counter",
		"# TYPE oneapi_request_duration_ms histogram",
		"oneapi_request_duration_ms_count 2",
		"oneapi_ttft_ms_count 1",
		"oneapi_circuit_state",
	}
	for _, s := range checks {
		if !strings.Contains(out, s) {
			t.Errorf("render output missing %q\n--- output ---\n%s", s, out)
		}
	}
}
