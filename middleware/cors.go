package middleware

import (
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/songquanpeng/one-api/common/config"
)

// CORS 返回安全的跨域中间件。
//
// 安全策略：
//   - 当配置了 CORS_ALLOW_ORIGINS（逗号分隔的源列表）时，仅允许指定源，并允许携带凭证（AllowCredentials=true）。
//   - 未配置时，允许所有源（AllowAllOrigins=true），但禁止携带凭证（AllowCredentials=false），
//     避免任意恶意网站携带用户 Cookie/Token 发起跨域请求。
//
// 注意：浏览器规范不允许 Access-Control-Allow-Origin: * 与 AllowCredentials: true 同时生效，
// 旧代码同时设置二者依赖 cors 库回退为反射 Origin，这实质上等于"任意源+带凭证"，存在 CSRF 风险。
func CORS() gin.HandlerFunc {
	cfg := cors.DefaultConfig()
	cfg.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"}
	cfg.AllowHeaders = []string{"*"}

	allowedOrigins := strings.TrimSpace(config.CORSAllowOrigins)
	if allowedOrigins != "" {
		// 显式配置了允许的源列表：精确匹配 + 允许凭证
		origins := splitAndTrim(allowedOrigins, ",")
		cfg.AllowOrigins = origins
		cfg.AllowCredentials = true
	} else {
		// 默认：允许所有源但禁止携带凭证，防止跨域 CSRF
		cfg.AllowAllOrigins = true
		cfg.AllowCredentials = false
	}

	return cors.New(cfg)
}

// splitAndTrim 按分隔符切分字符串并去除每个元素的首尾空白，过滤空元素。
func splitAndTrim(s, sep string) []string {
	parts := strings.Split(s, sep)
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
