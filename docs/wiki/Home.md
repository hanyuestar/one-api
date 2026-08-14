# one-api (hanyuestar fork)

这是 [one-api](https://github.com/songquanpeng/one-api) 的一个社区 fork，上游由 JustSong 开发。本 fork 在保持上游全部核心功能的前提下，额外增加了以下能力：

## 和上游的区别

### 新增渠道支持

| 功能 | 类型编号 | 说明 |
|------|---------|------|
| 阿里百炼（wanx） | type 49 | 接入通义万象生图，支持 wanx2.1-t2i-turbo / plus 等模型 |
| 豆包 Seedream | type 40 | 火山引擎生图，支持 doubao-seedream-4.0 / 5.0 系列 |

### 品牌信息

前端品牌信息已替换为 hanyuestar，页脚显示 `hanyuestar`。上游作者署名和主题作者信息均已保留：

- JustSong — 原始项目作者（README 开发行）
- Calon — air 主题作者
- MartialBE — berry 主题作者

### Docker 部署优化

相比上游，本 fork 的 Docker 构建做了以下改进：
- 固定基础镜像版本，避免任意漂移
- 非 root 用户运行，内置健康检查
- 新增 `.dockerignore`，镜像体积更小
- `docker-compose.yml` 保留默认值可单文件直接跑，生产环境按注释改密钥

### 模型倍率

默认倍率表已更新至 2026 年 8 月的最新官方定价，修正了上游几处错误，并补充了 50+ 个近期发布的模型。

### Bug 修复

| 版本 | 修复内容 |
|------|---------|
| v1.0.4 | 修复无限制额度令牌 `used_quota` 不累计的问题 |
| v1.0.3 | 修复阿里百炼 text 通道 `usage is nil` 问题；补全 berry 主题 5 个缺失渠道 |
| v1.0.2 | 修复 default 主题前端构建 eslint 配置错误 |
| v1.0.1 | 修正硬编码版本号与发布 tag 不一致 |
| v1.0.0 | Docker 构建全链路优化（基础镜像固定、非 root 运行、健康检查等） |

## 快速开始

```bash
# 零配置测试（SQLite 模式）
docker compose up -d

# 生产部署
cp .env.example .env   # 按注释修改密钥
docker compose up -d
```

镜像地址：
- `ghcr.io/hanyuestar/one-api:latest`（GitHub Container Registry）
- `kyson666/one-api:latest`（Docker Hub）

启动后访问 `http://localhost:3000`，默认账户 `root`，密码 `123456`。

## 项目结构

```
├── relay/          # API 适配层（渠道接入）
│   ├── adaptor/    # 各渠道适配器
│   └── billing/    # 计费 & 倍率逻辑
├── web/            # 前端（React）
│   ├── default/    # 默认主题
│   ├── air/        # air 主题
│   └── berry/       # berry 主题
├── model/          # 数据模型
├── controller/     # API 控制器
├── router/         # 路由
└── common/         # 共享工具
```

## 相关链接

- 上游原始项目：[songquanpeng/one-api](https://github.com/songquanpeng/one-api)
- 发布版本：[v1.0.4](https://github.com/hanyuestar/one-api/releases/tag/v1.0.4)（[查看更新日志](https://github.com/hanyuestar/one-api#%E6%9B%B4%E6%96%B0%E6%97%A5%E5%BF%97)）
- Docker 镜像：[GitHub Packages](https://github.com/hanyuestar/one-api/pkgs/container/one-api) | [Docker Hub](https://hub.docker.com/r/kyson666/one-api)
