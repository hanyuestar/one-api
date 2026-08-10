# syntax=docker/dockerfile:1.4

# ============================================================
# Stage 1: 前端构建
# ============================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /web

# 先复制 package.json 利用缓存
COPY web/default/package*.json ./default/
COPY web/berry/package*.json ./berry/
COPY web/air/package*.json ./air/

# 并行安装依赖 + BuildKit 缓存
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/web/default/node_modules \
    --mount=type=cache,target=/web/berry/node_modules \
    --mount=type=cache,target=/web/air/node_modules \
    npm install --prefix /web/default & \
    npm install --prefix /web/berry & \
    npm install --prefix /web/air & \
    wait

# 复制源码并构建
COPY web/default ./default
COPY web/berry ./berry
COPY web/air ./air
COPY VERSION .

# 读取版本，若 VERSION 为空则用 git describe 兜底，再兜底用 v0.0.0
RUN VERSION_CONTENT=$(cat VERSION 2>/dev/null | tr -d '\n') && \
    if [ -z "$VERSION_CONTENT" ]; then \
        VERSION_CONTENT=$(git describe --tags --always --dirty 2>/dev/null || echo "v0.0.0"); \
    fi && \
    echo "$VERSION_CONTENT" > VERSION && \
    DISABLE_ESLINT_PLUGIN=true REACT_APP_VERSION="$VERSION_CONTENT" npm run build --prefix /web/default & \
    DISABLE_ESLINT_PLUGIN=true REACT_APP_VERSION="$VERSION_CONTENT" npm run build --prefix /web/berry & \
    DISABLE_ESLINT_PLUGIN=true REACT_APP_VERSION="$VERSION_CONTENT" npm run build --prefix /web/air & \
    wait


# ============================================================
# Stage 2: Go 编译
# ============================================================
FROM golang:1.22-alpine AS go-builder

RUN apk add --no-cache gcc musl-dev sqlite-dev build-base

ENV GO111MODULE=on \
    CGO_ENABLED=1 \
    GOOS=linux \
    GOCACHE=/root/.cache/go-build

WORKDIR /build

# 先下载依赖（缓存层）
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download

# 复制源码（不含前端源码、node_modules、.git 等，靠 .dockerignore 过滤）
COPY . .

# 复制前端构建产物
COPY --from=frontend-builder /web/build ./web/build

# 读取版本（前端阶段已写入 VERSION 文件）
RUN VERSION_CONTENT=$(cat VERSION) && \
    go build -trimpath -ldflags "-s -w -X 'github.com/songquanpeng/one-api/common.Version=$VERSION_CONTENT' -linkmode external -extldflags '-static'" -o one-api


# ============================================================
# Stage 3: 运行时镜像
# ============================================================
FROM alpine:3.20 AS runtime

# 非 root 用户
RUN addgroup -g 1000 -S appgroup && \
    adduser -u 1000 -S appuser -G appgroup

# 运行时依赖：ca-certificates (HTTPS)、tzdata (时区)、sqlite-libs (CGO sqlite)
RUN apk add --no-cache ca-certificates tzdata sqlite-libs

WORKDIR /data

# 复制二进制
COPY --from=go-builder /build/one-api /usr/local/bin/one-api

# 权限
RUN chown appuser:appgroup /usr/local/bin/one-api

USER appuser

EXPOSE 3000

# 健康检查（使用 /api/status 接口，不依赖应用参数）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O - http://localhost:3000/api/status | grep -q '"success":true' || exit 1

ENTRYPOINT ["one-api"]