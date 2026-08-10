# syntax=docker/dockerfile:1.4

# ============================================================
# Stage 1: 前端构建
# ============================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /web

# 三步串行安装（每层独立 Docker 缓存，避免并行 & 在 Alpine ash 中不稳定）
COPY web/default/package*.json ./default/
RUN npm install --prefix /web/default --no-audit --no-fund

COPY web/berry/package*.json ./berry/
RUN npm install --prefix /web/berry --no-audit --no-fund

COPY web/air/package*.json ./air/
RUN npm install --prefix /web/air --no-audit --no-fund

# 复制源码并构建
COPY web/default ./default
COPY web/berry ./berry
COPY web/air ./air
COPY VERSION .

# 串行构建（读版本 → 三个主题分别构建）
RUN if [ -s VERSION ]; then VERSION_CONTENT=$(cat VERSION | tr -d '\n'); else VERSION_CONTENT=$(git describe --tags --always --dirty 2>/dev/null || echo "v0.0.0"); fi && \
    echo "$VERSION_CONTENT" > VERSION && \
    DISABLE_ESLINT_PLUGIN=true REACT_APP_VERSION="$VERSION_CONTENT" npm run build --prefix /web/default && \
    DISABLE_ESLINT_PLUGIN=true REACT_APP_VERSION="$VERSION_CONTENT" npm run build --prefix /web/berry && \
    DISABLE_ESLINT_PLUGIN=true REACT_APP_VERSION="$VERSION_CONTENT" npm run build --prefix /web/air


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