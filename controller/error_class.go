package controller

import (
	"net/http"
	"strings"

	relaymodel "github.com/songquanpeng/one-api/relay/model"
)

// F-010/F-012：统一错误分类，用于指标 label、探测日志与可观测性。
// 分类：auth | quota | rate_limit | timeout | upstream_5xx | content_policy | bad_request | network | unknown
func classifyError(err *relaymodel.ErrorWithStatusCode, statusCode int) string {
	if err != nil {
		statusCode = err.StatusCode
		code, _ := err.Error.Code.(string)
		code = strings.ToLower(strings.TrimSpace(code))
		msg := strings.ToLower(err.Error.Message)
		switch {
		case strings.Contains(code, "insufficient_quota") || strings.Contains(code, "billing") || strings.Contains(msg, "quota"):
			return "quota"
		case strings.Contains(code, "invalid_api_key") || strings.Contains(code, "account_deactivated") ||
			statusCode == http.StatusUnauthorized || statusCode == http.StatusForbidden:
			return "auth"
		case strings.Contains(code, "rate_limit") || statusCode == http.StatusTooManyRequests:
			return "rate_limit"
		case strings.Contains(code, "content_policy") || strings.Contains(msg, "content policy") || strings.Contains(msg, "content_filter"):
			return "content_policy"
		case strings.Contains(code, "timeout") || strings.Contains(msg, "timeout") || strings.Contains(msg, "deadline exceeded"):
			return "timeout"
		case statusCode == http.StatusBadRequest:
			return "bad_request"
		case statusCode >= 500:
			return "upstream_5xx"
		}
	}
	switch {
	case statusCode == http.StatusTooManyRequests:
		return "rate_limit"
	case statusCode == http.StatusUnauthorized || statusCode == http.StatusForbidden:
		return "auth"
	case statusCode >= 500:
		return "upstream_5xx"
	case statusCode == 0:
		return "network"
	case statusCode >= 400:
		return "bad_request"
	}
	return "unknown"
}
