# Docker 部署指南

## 前提条件

- 安装 [Docker](https://docs.docker.com/get-docker/) 和 [Docker Compose](https://docs.docker.com/compose/install/)
- 如果只用 SQLite（零配置），不需要额外安装数据库

## 三种部署方式

### 方式一：SQLite 模式（零依赖，适合测试）

直接启动，什么都不用改：

```bash
# 下载 compose 文件
wget https://raw.githubusercontent.com/hanyuestar/one-api/main/docker-compose.yml

# 注释掉 MySQL 和 Redis 相关行后启动（或直接跑，MySQL 会报错但不影响 SQLite）
docker compose up -d one-api
```

或者干脆跑单容器：

```bash
docker run -d --name one-api \
  -p 3000:3000 \
  -v $(pwd)/data:/data \
  -e TZ=Asia/Shanghai \
  ghcr.io/hanyuestar/one-api:latest
```

### 方式二：docker-compose 一键部署（推荐）

```bash
# 准备文件
wget https://raw.githubusercontent.com/hanyuestar/one-api/main/docker-compose.yml
wget https://raw.githubusercontent.com/hanyuestar/one-api/main/.env.example -O .env

# 编辑 .env，至少修改以下三项
# SESSION_SECRET — 用 openssl rand -base64 32 生成
# MYSQL_ROOT_PASSWORD — 强密码
# MYSQL_PASSWORD — 强密码（建议和 root 不同）

# 启动
docker compose up -d
```

启动后访问 `http://localhost:3000`。

### 方式三：手动构建

如果需要修改源码后自行构建：

```bash
git clone https://github.com/hanyuestar/one-api.git
cd one-api
DOCKER_BUILDKIT=1 docker build -t one-api:custom .
docker run -d --name one-api -p 3000:3000 -v $(pwd)/data:/data one-api:custom
```

## 环境变量说明

以下按重要性排序，标注【必改】的在生产环境必须更换：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SQL_DSN` | 无（走 SQLite） | MySQL 连接串，格式 `user:password@tcp(host:3306)/dbname` |
| `REDIS_CONN_STRING` | `redis://redis` | Redis 地址，有密码时 `redis://:password@host:6379` |
| `SESSION_SECRET` | 占位值 | 【必改】会话加密密钥，Linux/Mac 用 `openssl rand -base64 32` 生成，Windows 用 PowerShell `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))` |
| `TZ` | `Asia/Shanghai` | 时区 |
| `NODE_TYPE` | 不设置（主节点） | 多机部署时设为 `slave` |
| `SYNC_FREQUENCY` | `60` | 多机同步间隔（秒） |
| `FRONTEND_BASE_URL` | 不设置 | 多机部署时前端地址 |

MySQL 凭据：

| 变量 | 说明 |
|------|------|
| `MYSQL_ROOT_PASSWORD` | 【必改】MySQL root 密码 |
| `MYSQL_USER` | 应用数据库用户 |
| `MYSQL_PASSWORD` | 【必改】应用数据库密码 |
| `MYSQL_DATABASE` | 数据库名 |

## 切换镜像源

`docker-compose.yml` 默认用 ghcr.io，要切换到 Docker Hub：

```bash
IMAGE=kyson666/one-api docker compose up -d
```

## 常见问题

**Q: 端口被占用怎么办？**

修改 `docker-compose.yml` 中 `ports` 行，比如把 `3000:3000` 改成 `8080:3000`。

**Q: MySQL 连接失败？**

先确认 MySQL 容器正常启动：`docker compose ps db`。如果首次启动 MySQL 特别慢（需要初始化），可以等 1-2 分钟再试。

**Q: 只想用 SQLite，能跳过 MySQL 吗？**

注释掉 `SQL_DSN` 行即可。此时数据存在 `./data/oneapi/` 目录下的 SQLite 文件中。

**Q: 如何升级？**

```bash
docker compose pull          # 拉最新镜像
docker compose up -d --remove-orphans   # 重建容器
```

数据在 `./data/` 目录持久化，升级不会丢失。
