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

### 缓存命中计费

本 fork 支持按「缓存命中（读缓存）」与「缓存写入（写缓存）」对输入 token 差异化计费：

- **缓存命中倍率**：缓存命中的输入 token 按折扣系数计费（内置 OpenAI 0.5、Anthropic 0.1、DeepSeek 0.1 等常见模型费率）。
- **缓存写入倍率**：写入缓存的输入 token 按加价系数计费（Anthropic 为 1.25）。
- 管理员可在「设置 → 运营设置 → 倍率设置」中通过 JSON 自定义这两个倍率（与模型倍率同款样式）；未配置的模型默认按正常输入计费。
- 渠道返回缓存字段（OpenAI `cached_tokens`、DeepSeek `prompt_cache_hit_tokens`、Anthropic `cache_read/cache_creation_input_tokens`）时自动生效；渠道不支持时按正常输入计费兜底。
- 日志「输入」列会标注缓存命中部分，如 `1000（缓存命中 200）`。

### 日志与分析增强（v1.0.7）

- **日志模块全面增强**：三套主题（default/air/berry）日志页新增顶部摘要卡（总消耗额度 / 总 Token / 请求数 / 平均首字延迟），新增「用时」「首字」「分组」「IP」列；行展开可查看请求详情（Request ID、缓存命中/写入、首字延迟、总耗时、结构化计费明细）。
- **首页数据看板**：首页新增「账户数据 / 使用统计 / 资源消耗 / 性能指标」四组摘要卡。
- **首字延迟（TTFT）统计**：流式请求记录首个非空内容 token 到达时刻（毫秒），日志页「首字」列与看板平均首字延迟展示；非流式与纯工具调用请求不记录，避免语义混淆。
- **计费明细结构化与公式反查**：消费日志新增结构化计费明细（模型倍率 / 分组倍率 / 输出倍率 / 缓存命中折扣 / 缓存写入加价 / 渠道类型 / 各计费分量），日志展开可查看完整计费公式，支持对账与一致性校验。
- **模型分析看板**：按模型聚合请求数、消耗额度、Token、平均首字延迟、平均耗时；管理员查看全域、普通用户查看自身（`/api/log/model-analysis` 与 `/api/log/self/model-analysis`）。

### Bug 修复

| 版本 | 修复内容 |
|------|---------|
| v1.0.8 | 并发 map panic 锁保护(H1)；PG 首字延迟类型转换(M1)；前端版本号传递(M3)；流式异步计费 ctx 脱离取消(L6)；SQLite/MySQL 均值 ROUND 四舍五入(L3)；deepl 响应体关闭(L4)；图片日志计费明细(L7)；统计按渠道筛选(M2)；air 数据看板常驻(M4)；首次登录强制改密(L1)；日志横排与 air UI 统一 |
| v1.0.7 | 日志模块增强与 TTFT 首字延迟统计；新增计费明细反查与模型分析看板；修正缓存命中展示与真实计费口径不一致的问题 |
| v1.0.6 | 修复 Anthropic/Bedrock Claude 缓存计费少计约 60%；修复普通用户经 proxy 路由越权指定渠道；修复配额预扣并发竞态；令牌 Key 改用 crypto/rand；修复会话类型断言 panic；Air 主题恢复渠道「分组」列；清理 /chat 死路由 |
| v1.0.5 | 移除令牌聊天功能；新增缓存命中/写入计费；日志「提示/补全」更名「输入/输出」 |
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
- 发布版本：[v1.0.7](https://github.com/hanyuestar/one-api/releases/tag/v1.0.7)（[查看更新日志](https://github.com/hanyuestar/one-api#%E6%9B%B4%E6%96%B0%E6%97%A5%E5%BF%97)）
- Docker 镜像：[GitHub Packages](https://github.com/hanyuestar/one-api/pkgs/container/one-api) | [Docker Hub](https://hub.docker.com/r/kyson666/one-api)
