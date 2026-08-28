package controller

import (
	"net/http"
	"testing"

	relaymodel "github.com/songquanpeng/one-api/relay/model"
)

func TestClassifyError(t *testing.T) {
	cases := []struct {
		name       string
		err        *relaymodel.ErrorWithStatusCode
		statusCode int
		want       string
	}{
		{"401", &relaymodel.ErrorWithStatusCode{StatusCode: 401, Error: relaymodel.Error{Code: "invalid_api_key", Message: "bad key"}}, 0, "auth"},
		{"403", &relaymodel.ErrorWithStatusCode{StatusCode: 403, Error: relaymodel.Error{Code: "account_deactivated"}}, 0, "auth"},
		{"429", &relaymodel.ErrorWithStatusCode{StatusCode: 429, Error: relaymodel.Error{Code: "rate_limit_exceeded"}}, 0, "rate_limit"},
		{"500", &relaymodel.ErrorWithStatusCode{StatusCode: 500, Error: relaymodel.Error{Code: "internal_error"}}, 0, "upstream_5xx"},
		{"quota", &relaymodel.ErrorWithStatusCode{StatusCode: 400, Error: relaymodel.Error{Code: "insufficient_quota"}}, 0, "quota"},
		{"content_policy", &relaymodel.ErrorWithStatusCode{StatusCode: 400, Error: relaymodel.Error{Code: "content_policy_violation"}}, 0, "content_policy"},
		{"timeout", &relaymodel.ErrorWithStatusCode{StatusCode: 504, Error: relaymodel.Error{Code: "timeout", Message: "deadline exceeded"}}, 0, "timeout"},
		{"bad_request", &relaymodel.ErrorWithStatusCode{StatusCode: 400, Error: relaymodel.Error{Code: "invalid_request"}}, 0, "bad_request"},
		{"nil_err_status_429", nil, 429, "rate_limit"},
		{"nil_err_status_0", nil, 0, "network"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := classifyError(c.err, c.statusCode); got != c.want {
				t.Errorf("classifyError() = %q, want %q", got, c.want)
			}
		})
	}
}

func TestClassifyError_HTTPStatusOnly(t *testing.T) {
	if got := classifyError(nil, http.StatusUnauthorized); got != "auth" {
		t.Errorf("401 = %s", got)
	}
	if got := classifyError(nil, http.StatusBadGateway); got != "upstream_5xx" {
		t.Errorf("502 = %s", got)
	}
}
