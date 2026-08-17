<p align="right">
    <a href="./README.md">中文</a> | <strong>English</strong> | <a href="./README.ja.md">日本語</a>
</p>


<p align="center">
  <a href="https://github.com/hanyuestar/one-api"><img src="https://raw.githubusercontent.com/songquanpeng/one-api/main/web/default/public/logo.png" width="150" height="150" alt="one-api logo"></a>
</p>

<div align="center">

# One API

_✨ Open-source OpenAI API management & distribution system with image generation support ✨_

> This repository is maintained based on [songquanpeng/one-api](https://github.com/songquanpeng/one-api). It adds Alibaba Bailian & Volcano Engine image generation support and is pushed to both ghcr.io and Docker Hub.

</div>

<p align="center">
  <a href="https://raw.githubusercontent.com/songquanpeng/one-api/main/LICENSE">
    <img src="https://img.shields.io/github/license/hanyuestar/one-api?color=brightgreen" alt="license">
  </a>
  <a href="https://github.com/hanyuestar/one-api/pkgs/container/one-api">
    <img src="https://img.shields.io/badge/ghcr.io-hanyuestar%2Fone--api-blue" alt="ghcr">
  </a>
  <a href="https://hub.docker.com/r/kyson666/one-api">
    <img src="https://img.shields.io/docker/pulls/kyson666/one-api?color=brightgreen" alt="docker pull">
  </a>
  <a href="https://goreportcard.com/report/github.com/songquanpeng/one-api">
    <img src="https://goreportcard.com/badge/github.com/songquanpeng/one-api" alt="GoReportCard">
  </a>
</p>

<p align="center">
  <a href="#deployment">Deployment</a>
  ·
  <a href="#usage">Usage</a>
  ·
  <a href="https://github.com/hanyuestar/one-api/issues">Feedback</a>
  ·
  <a href="https://github.com/hanyuestar/one-api/wiki">Wiki</a>
  ·
  <a href="#faq">FAQ</a>
</p>

> [!NOTE]
> This project is open source. Users must comply with OpenAI's [Terms of Use](https://openai.com/policies/terms-of-use) and **applicable laws and regulations**, and must not use it for illegal purposes.
>
> In accordance with the [Interim Measures for the Management of Generative AI Services](http://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm), please do not provide any unregistered generative AI services to the public in mainland China.

> [!NOTE]
> Docker images of this repository:
> - GitHub Container Registry: `ghcr.io/hanyuestar/one-api:latest`
> - Docker Hub: `kyson666/one-api:latest`
>
> Upstream original image: [justsong/one-api](https://hub.docker.com/repository/docker/justsong/one-api) or [ghcr.io/songquanpeng/one-api](https://github.com/songquanpeng/one-api/pkgs/container/one-api)

> [!WARNING]
> After the first login with the root user, be sure to change the default password `123456`!

## Changelog

### v1.0.6 (2026-08-17)

**Bug Fixes**

- **Fix severe under-billing for Anthropic / AWS Bedrock Claude cache usage**: Anthropic's `input_tokens` does not include `cache_read`/`cache_creation` (they are reported separately). The previous billing formula assumed the OpenAI convention (`prompt_tokens` already includes cached tokens), so cached tokens were deducted twice, under-billing all cache-using Claude requests by ~60%. Cache read/write tokens are now merged into `PromptTokens` to match the OpenAI convention (both streaming and non-streaming fixed).
- **Fix privilege escalation allowing ordinary users to force any channel (security)**: the `/v1/oneapi/proxy/:channelid/*` route previously let any authenticated token force a specific channel, bypassing group/model assignment and risking use of admin channels or unauthorized models. It is now aligned with the token key suffix rule: only admins can specify a channel.
- **Fix defensive clamp corrupting logged cache statistics**: when cached tokens exceed total input tokens, the defensive fallback now only affects the billing calculation and no longer rewrites the persisted cache hit/write statistics.
- **Fix quota pre-consumption race condition (TOCTOU)**: token/user quota pre-deduction now uses atomic conditional updates (`WHERE remain_quota >= ?` with affected-row checks), preventing negative balances under high concurrency.
- **Fix weak randomness in API token keys**: token keys are now generated with `crypto/rand` (replacing `math/rand` with a time seed), eliminating predictability in the first 16 characters.
- **Fix session type-assertion panic**: the auth middleware now checks type assertions with `ok`, so malformed sessions no longer cause panics.
- **Fix tool-call argument parsing**: added protection for the `Arguments` type assertion in the Anthropic adapter; JSON parse failures are now logged instead of silently ignored.

**Enhancements**

- **Restore the "Group" column in the Air theme channel table**: aligned with the default/berry themes so channel groups are visible.
- **Remove dead `/chat` routes**: deleted leftover `/chat` routes in the default/air themes and the orphan mapping in the air sidebar, consistent with the berry theme.
- **Consolidate cache field mapping**: cache-hit field mapping for OpenAI-compatible channels now lives solely in the billing fallback logic, eliminating duplicated mapping.

### v1.0.5 (2026-08-14)

**Enhancements**

- **Remove chat functionality**: this image is positioned as a pure AI API management & distribution platform; the chat entry on the token page, chat client menu (ChatGPT Next Web / AMA / OpenCat / LobeChat, etc.), chat link setting, and the standalone `/chat` embedded page have been removed from all three themes (default/air/berry) to focus on core distribution capabilities.
- **Add cache-hit billing**: input tokens are now billed differently for "cache hit (read)" and "cache write". Cache hits are billed at a discount ratio (built-in OpenAI 0.5, Anthropic 0.1, DeepSeek 0.1, etc.), cache writes at a markup ratio (Anthropic 1.25). New "Cache Hit Ratio" and "Cache Write Ratio" settings (same JSON editing style as model ratios) are available for admins; models without configuration default to normal input billing.
- **Rename log fields**: the "Prompt / Completion" columns in the log page are renamed to "Input / Output", and the input column marks the cache-hit portion (e.g., `1000 (cache hit 200)`).
- **Cache data fallback**: cache data is now extracted at the parsing layer for OpenAI-compatible channels (`prompt_tokens_details.cached_tokens`, DeepSeek `prompt_cache_hit_tokens`) and Anthropic (`cache_read_input_tokens` / `cache_creation_input_tokens`); channels that do not return cache fields fall back to normal input billing without affecting the original billing logic.

### v1.0.4 (2026-08-14)

**Bug Fixes**

- Fix the "Used Quota" always showing 0 on the token page. Root cause: `PreConsumeTokenQuota` and `PostConsumeTokenQuota` skipped the `used_quota` accumulation for unlimited tokens (`UnlimitedQuota=true`). `used_quota` is now written separately for unlimited tokens, without affecting limited tokens.

### v1.0.3 (2026-08-11)

**Bug Fixes**

- Fix the Ali Bailian channel (type 49) text conversation returning `usage is nil`. The channel's standalone adapter `DoResponse` previously failed to extract usage, causing requests to be **unbilled and logs not recorded**. It now reuses the standard OpenAI Handler/StreamHandler; image generation is unaffected.

**Enhancements**

- Complete the 5 missing channel registrations in the **berry theme**: Baidu Qianfan V2, iFlytek Spark V2, Alibaba Bailian, OpenAI-compatible, Gemini (OpenAI). Channel types across the three themes (default/air/berry) are now fully aligned (51 types).
- Unify the go.mod version declaration to `1.22`, consistent with the Docker build environment.
- Fix the Replicate channel object key inconsistency in the berry theme's `ChannelConstants.js`.

### v1.0.2 (2026-08-10)

- Fix the default theme frontend build failure: removed the `react-app/jest` reference from the eslint config (the `jest/globals` environment key is no longer recognized in react-scripts 5).

### v1.0.1 (2026-08-10)

- Fix the default version number from `v0.0.0` to `v1.0.0`, consistent with the release tag.
- Add Wiki docs (`docs/wiki/`): project overview, Docker deployment guide, model ratio documentation.

### v1.0.0 (2026-08-10)

**Docker Deployment Improvements**

- Pin base image versions: Node 20 / Go 1.22 / Alpine 3.20, avoiding version drift.
- Add `.dockerignore`, excluding node_modules, build artifacts, database files, etc., significantly reducing image size.
- Multi-stage build with BuildKit cache mounts, speeding up rebuilds.
- Run as a non-root user (appuser) at runtime, with built-in HTTP health check.
- `docker-compose.yml` runs out of the box (SQLite mode); modify secrets per comments for production.
- Add `.env.example` template.

**Model Ratio Updates**

- Fix outdated/incorrect ratios: `gpt-4o` ($5/M→$2.5/M), `o3-mini` ($3/M→$1.1/M), `qwen2.5-32b/3b`, etc.
- Add ratios for 50+ common models (GPT-4.1/5, Claude 4.x, Gemini 2.5/3, DeepSeek V4, GLM-4.5/4.6/4.7, qwen3, Doubao Seed series, Kimi K2, etc.).

## Features
1. Support for multiple large models:
   + [x] [OpenAI ChatGPT Series Models](https://platform.openai.com/docs/guides/gpt/chat-completions-api) (Supports [Azure OpenAI API](https://learn.microsoft.com/en-us/azure/ai-services/openai/reference))
   + [x] [Anthropic Claude Series Models](https://anthropic.com) (Supports AWS Claude)
   + [x] [Google PaLM2/Gemini Series Models](https://developers.generativeai.google)
   + [x] [Mistral Series Models](https://mistral.ai/)
   + [x] [ByteDance Doubao (Volcano Engine)](https://www.volcengine.com/experience/ark?utm_term=202502dsinvite&ac=DSASUQY5&rc=2QXCA1VI)
   + [x] [Baidu Wenxin Yiyan Series Models](https://cloud.baidu.com/doc/WENXINWORKSHOP/index.html)
   + [x] [Alibaba Tongyi Qianwen Series Models](https://help.aliyun.com/document_detail/2400395.html)
   + [x] [iFlytek Spark Cognitive Models](https://www.xfyun.cn/doc/spark/Web.html)
   + [x] [Zhipu ChatGLM Series Models](https://bigmodel.cn)
   + [x] [360 Zhinao](https://ai.360.cn)
   + [x] [Tencent Hunyuan](https://cloud.tencent.com/document/product/1729)
   + [x] [Moonshot AI](https://platform.moonshot.cn/)
   + [x] [Baichuan](https://platform.baichuan-ai.com)
   + [x] [MINIMAX](https://api.minimax.chat/)
   + [x] [Groq](https://wow.groq.com/)
   + [x] [Ollama](https://github.com/ollama/ollama)
   + [x] [Lingyi Wanwu](https://platform.lingyiwanwu.com/)
   + [x] [StepFun](https://platform.stepfun.com/)
   + [x] [Coze](https://www.coze.com/)
   + [x] [Cohere](https://cohere.com/)
   + [x] [DeepSeek](https://www.deepseek.com/)
   + [x] [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
   + [x] [DeepL](https://www.deepl.com/)
   + [x] [together.ai](https://www.together.ai/)
   + [x] [novita.ai](https://www.novita.ai/)
   + [x] [SiliconFlow](https://cloud.siliconflow.cn/i/rKXmRobW)
   + [x] [xAI](https://x.ai/)
2. Supports configuring mirror sites and many [third-party proxy services](https://iamazing.cn/page/openai-api-third-party-services).
3. Supports accessing multiple channels through **load balancing**.
4. Supports **stream mode** with typewriter effects via streaming.
5. Supports **multi-machine deployment**, [see here](#multi-machine-deployment).
6. Supports **token management** — set token expiration time, quota, allowed IP ranges, and allowed model access.
7. Supports **redemption code management** — batch generation and export, can be used to top up accounts.
8. Supports **channel management** — batch creation of channels.
9. Supports **user groups** and **channel groups** — different ratios for different groups.
10. Supports setting a **model list** per channel.
11. Supports **viewing quota details**.
12. Supports **user invitation rewards**.
13. Supports displaying quota in USD.
14. Supports publishing announcements, setting recharge links, and setting initial quota for new users.
15. Supports model mapping to redirect user request models. Please do not set it unless necessary — setting it reconstructs the request body instead of passing it through, which may prevent some not-yet-officially-supported fields from being delivered.
16. Supports automatic retry on failure.
17. Supports image generation interfaces (DALL-E / Tongyi Wanxiang / Volcano Seedream / CogView / Replicate), see [[Image-Generation]].
18. Supports [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/providers/openai/) — fill `https://gateway.ai.cloudflare.com/v1/ACCOUNT_TAG/GATEWAY/openai` in the proxy field of the channel settings.
19. Rich **customization** settings:
    1. Custom system name, logo, and footer.
    2. Custom home page and about page — via HTML & Markdown, or embed a separate page with an iframe.
20. Supports calling the management API with a system access token, enabling **extension and customization without code changes**. See the [API docs](./docs/API.md).
21. Supports Cloudflare Turnstile user verification.
22. Supports user management and **multiple login/registration methods**:
    + Email registration/login (with registration email whitelist) and password reset via email.
    + [Feishu (Lark) OAuth login](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/authorize/get) ([implementation details here](https://iamazing.cn/page/feishu-oauth-login)).
    + [GitHub OAuth login](https://github.com/settings/applications/new).
    + WeChat Official Account authorization (requires deploying [WeChat Server](https://github.com/songquanpeng/wechat-server) separately).
23. Supports theme switching via the `THEME` environment variable, default `default`. PRs for more themes are welcome — see [here](./web/README.md).
24. Works with [Message Pusher](https://github.com/songquanpeng/message-pusher) to push alerts to various Apps.
25. 🆕 **Alibaba Bailian (Tongyi Wanxiang) image generation** — channel type 49, supports wanx-v1 / stable-diffusion series.
26. 🆕 **Volcano Engine (Seedream) image generation** — channel type 40, supports Seedream 4.0/4.5/5.0 series.
27. 🆕 **Air theme channel type completion** — added Baidu V2, iFlytek V2, Alibaba Bailian, OpenAI-compatible, Gemini OpenAI.

## Deployment
### Docker Deployment
```shell
# Use ghcr.io image (recommended):
docker run --name one-api -d --restart always -p 3000:3000 -e TZ=Asia/Shanghai -v /home/ubuntu/data/one-api:/data ghcr.io/hanyuestar/one-api:latest
# Docker Hub image:
docker run --name one-api -d --restart always -p 3000:3000 -e TZ=Asia/Shanghai -v /home/ubuntu/data/one-api:/data kyson666/one-api:latest
# Use MySQL:
docker run --name one-api -d --restart always -p 3000:3000 -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" -e TZ=Asia/Shanghai -v /home/ubuntu/data/one-api:/data ghcr.io/hanyuestar/one-api:latest
```

The first `3000` in `-p 3000:3000` is the host port and can be changed as needed.

Data and logs are saved to `/home/ubuntu/data/one-api` on the host. Please make sure the directory exists and is writable, or change it to a suitable directory.

If the startup fails, add `--privileged=true`; see https://github.com/songquanpeng/one-api/issues/482 .

If the images above cannot be pulled, try Docker Compose deployment (below) or the upstream original image.

If your concurrency is high, **be sure** to set `SQL_DSN`; see the [environment variables](#environment-variables) section below.

Update command: `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock containrrr/watchtower -cR`

Sample Nginx configuration:
```
server{
   server_name openai.justsong.cn;  # change to your own domain

   location / {
          client_max_body_size  64m;
          proxy_http_version 1.1;
          proxy_pass http://localhost:3000;  # change to your own port
          proxy_set_header Host $host;
          proxy_set_header X-Forwarded-For $remote_addr;
          proxy_cache_bypass $http_upgrade;
          proxy_set_header Accept-Encoding gzip;
          proxy_read_timeout 300s;  # GPT-4 needs a longer timeout, adjust as needed
   }
}
```

Then configure HTTPS with Let's Encrypt certbot:
```bash
# Install certbot on Ubuntu:
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
# Generate certificates & modify Nginx configuration
sudo certbot --nginx
# Follow the prompts
# Restart Nginx
sudo service nginx restart
```

The initial account is `root` with password `123456`.

### One-click Deployment via Baota Panel
1. Install Baota Panel 9.2.0 or above from the [Baota Panel](https://www.bt.cn/new/download.html?r=dk_oneapi) official website (choose the official version script).
2. Log in to the Baota Panel, click `Docker` in the left menu. On first entry it will prompt to install the `Docker` service — click install now and follow the prompts.
3. After installation, search for `One-API` in the App Store, click install, configure the domain and basic info to finish.

### Docker Compose Deployment

The repository ships with `docker-compose.yml` for one-click deployment (MySQL + Redis + One API):

```shell
# Use ghcr.io image (default)
docker compose up -d

# Use Docker Hub image
IMAGE=kyson666/one-api docker compose up -d
```

### Manual Deployment
1. Download the executable from [this repository's Releases](https://github.com/hanyuestar/one-api) or build from source:
   ```shell
   git clone https://github.com/hanyuestar/one-api.git

   # Build the frontend
   cd one-api/web/default
   npm install
   npm run build

   # Build the backend
   cd ../..
   go mod download
   go build -ldflags "-s -w" -o one-api
   ````
2. Run:
   ```shell
   chmod u+x one-api
   ./one-api --port 3000 --log-dir ./logs
   ```
3. Visit [http://localhost:3000/](http://localhost:3000/) and log in. The initial account is `root` with password `123456`.

A more detailed deployment tutorial can be found [here](https://iamazing.cn/page/how-to-deploy-a-website).

### Multi-machine Deployment
1. All servers must set the same `SESSION_SECRET`.
2. You must set `SQL_DSN` to use MySQL instead of SQLite; all servers connect to the same database.
3. All slave servers must set `NODE_TYPE` to `slave`; if unset, the server is the master.
4. Set `SYNC_FREQUENCY` so servers periodically sync configuration from the database; with a remote database, it is recommended to set this and enable Redis, on both master and slave.
5. Slave servers may set `FRONTEND_BASE_URL` to redirect page requests to the master server.
6. Install Redis **separately** on each slave server and set `REDIS_CONN_STRING`, so the database is not accessed when the cache is valid, reducing latency (Redis cluster/sentinel support: see the environment variable docs).
7. If the master server also has high database latency, enable Redis and set `SYNC_FREQUENCY` to periodically sync configuration.

See [here](#environment-variables) for the detailed usage of environment variables.

### Baota Deployment Tutorial

See [#175](https://github.com/songquanpeng/one-api/issues/175).

If the page is blank after deployment, see [#97](https://github.com/songquanpeng/one-api/issues/97).

### Deploying Third-party Services with One API
> PRs adding more examples are welcome.

#### ChatGPT Next Web
Project page: https://github.com/Yidadaa/ChatGPT-Next-Web

```bash
docker run --name chat-next-web -d -p 3001:3000 yidadaa/chatgpt-next-web
```

Remember to change the port, then set the interface address (e.g., `https://openai.justsong.cn/`) and API Key on the page.

#### ChatGPT Web
Project page: https://github.com/Chanzhaoyu/chatgpt-web

```bash
docker run --name chatgpt-web -d -p 3002:3002 -e OPENAI_API_BASE_URL=https://openai.justsong.cn -e OPENAI_API_KEY=sk-xxx chenzhaoyu94/chatgpt-web
```

Remember to change the port, `OPENAI_API_BASE_URL` and `OPENAI_API_KEY`.

#### QChatGPT - QQ Robot
Project page: https://github.com/RockChinQ/QChatGPT

After deploying per the [docs](https://qchatgpt.rockchin.top), set `requester.openai-chat-completions.base-url` in `data/provider.json` to your One API instance address, put the API Key into the `keys.openai` group, and set `model` to the model name you want.

Use the `!model` command at runtime to view/switch available models.

### Deploy to Third-party Platforms
<details>
<summary><strong>Deploy to Sealos</strong></summary>
<div>

> Sealos servers are overseas, no extra network handling needed; supports high concurrency & dynamic scaling.

Click the button below for one-click deployment (if you see 404 after deployment, wait 3~5 minutes):

[![Deploy-on-Sealos.svg](https://raw.githubusercontent.com/labring-actions/templates/main/Deploy-on-Sealos.svg)](https://cloud.sealos.io/?openapp=system-fastdeploy?templateName=one-api)

</div>
</details>

<details>
<summary><strong>Deploy to Zeabur</strong></summary>
<div>

> Zeabur servers are overseas, solving network issues automatically; the free quota is enough for personal use.

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/7Q0KO3)

1. First fork a copy of the code.
2. Go to [Zeabur](https://zeabur.com?referralCode=songquanpeng), log in, and enter the console.
3. Create a new Project; in Service -> Add Service select Marketplace, choose MySQL, and note the connection parameters (username, password, address, port).
4. Paste the connection parameters and run ```create database `one-api` ``` to create the database.
5. In Service -> Add Service, choose Git (authorize on first use) and select your forked repository.
6. Deploy starts automatically — cancel it first. Go to Variable below, add `PORT` = `3000`, and add `SQL_DSN` = `<username>:<password>@tcp(<addr>:<port>)/one-api`, then save. Note: without `SQL_DSN`, data will not persist and will be lost on redeploy.
7. Choose Redeploy.
8. Go to Domains below and choose a suitable domain prefix, e.g. "my-one-api" → final domain "my-one-api.zeabur.app"; you can also CNAME your own domain.
9. Wait for the deployment to finish, then click the generated domain to enter One API.

</div>
</details>

<details>
<summary><strong>Deploy to Render</strong></summary>
<div>

> Render offers a free tier; binding a card raises the limits further.

Render can deploy docker images directly without forking: https://dashboard.render.com

</div>
</details>

## Configuration
The system works out of the box.

You can configure it via environment variables or command-line arguments.

After the system starts, log in with the `root` user for further configuration.

**Note**: if you don't know what a configuration item means, temporarily remove its value to see the hint text.

## Usage
Add your API Key on the `Channels` page, then create an access token on the `Tokens` page.

You can then access One API with your token, in the same way as the [OpenAI API](https://platform.openai.com/docs/api-reference/introduction).

Set the API Base of every place that uses the OpenAI API to your One API deployment address, e.g., `https://openai.justsong.cn`, and use the token generated in One API as the API Key.

Note that the exact API Base format depends on the client you use.

For example, with the official OpenAI library:
```bash
OPENAI_API_KEY="sk-xxxxxx"
OPENAI_API_BASE="https://<HOST>:<PORT>/v1"
```

```mermaid
graph LR
    A(User)
    A --->|Request with key distributed by One API| B(One API)
    B -->|Relay request| C(OpenAI)
    B -->|Relay request| D(Azure)
    B -->|Relay request| E(Other OpenAI API format downstream channels)
    B -->|Relay and modify request body and response body| F(Non-OpenAI API format downstream channels)
```

You can force a specific channel for a request by appending the channel ID to the token, e.g.: `Authorization: Bearer ONE_API_KEY-CHANNEL_ID`.
Note: only tokens created by admin users can specify a channel ID.

Without it, multiple channels are used via load balancing.

### Environment Variables
> One API supports reading environment variables from a `.env` file; refer to `.env.example` and rename it to `.env` when using.
1. `REDIS_CONN_STRING`: enables Redis as the cache when set.
   + Example: `REDIS_CONN_STRING=redis://default:redispw@localhost:49153`
   + If database access latency is low, there is no need to enable Redis — enabling it may cause data lag.
   + For sentinel or cluster mode:
     + Set the variable to the node list, e.g., `localhost:49153,localhost:49154,localhost:49155`.
     + Also set the following:
       + `REDIS_PASSWORD`: password for Redis cluster or sentinel mode.
       + `REDIS_MASTER_NAME`: master node name in Redis sentinel mode.
2. `SESSION_SECRET`: sets a fixed session secret so logged-in users' cookies remain valid after a restart.
   + Example: `SESSION_SECRET=random_string`
3. `SQL_DSN`: uses the specified database instead of SQLite; use MySQL or PostgreSQL.
   + Examples:
     + MySQL: `SQL_DSN=root:123456@tcp(localhost:3306)/oneapi`
     + PostgreSQL: `SQL_DSN=postgres://postgres:123456@localhost:5432/oneapi` (in adaptation; feedback welcome)
   + Create the database `oneapi` in advance — no manual table creation needed; the program creates tables automatically.
   + For a local database: add `--network="host"` to the deployment command so the container can reach MySQL on the host.
   + For a cloud database: if the cloud server requires identity verification, add `?tls=skip-verify` to the connection string.
   + Adjust the following parameters per your database configuration (or keep defaults):
     + `SQL_MAX_IDLE_CONNS`: max idle connections, default `100`.
     + `SQL_MAX_OPEN_CONNS`: max open connections, default `1000`.
       + If you see `Error 1040: Too many connections`, lower this value.
     + `SQL_CONN_MAX_LIFETIME`: max connection lifetime, default `60` minutes.
4. `LOG_SQL_DSN`: uses a separate database for the `logs` table when set; use MySQL or PostgreSQL.
5. `FRONTEND_BASE_URL`: redirects page requests to the specified address; only for slave servers.
   + Example: `FRONTEND_BASE_URL=https://openai.justsong.cn`
6. `MEMORY_CACHE_ENABLED`: enables in-memory cache; user quota updates will lag slightly. Values: `true` / `false`, default `false`.
   + Example: `MEMORY_CACHE_ENABLED=true`
7. `SYNC_FREQUENCY`: frequency of syncing configuration from the database when cache is enabled, in seconds, default `600`.
   + Example: `SYNC_FREQUENCY=60`
8. `NODE_TYPE`: node type. Values: `master` / `slave`, default `master`.
   + Example: `NODE_TYPE=slave`
9. `CHANNEL_UPDATE_FREQUENCY`: periodically updates channel balance, in minutes; no update when unset.
   + Example: `CHANNEL_UPDATE_FREQUENCY=1440`
10. `CHANNEL_TEST_FREQUENCY`: periodically checks channels, in minutes; no check when unset.
   + Example: `CHANNEL_TEST_FREQUENCY=1440`
11. `POLLING_INTERVAL`: request interval when batch-updating channel balance and testing availability, in seconds, no interval by default.
    + Example: `POLLING_INTERVAL=5`
12. `BATCH_UPDATE_ENABLED`: enables database batch update aggregation; user quota updates will lag slightly. Values: `true` / `false`, default `false`.
    + Example: `BATCH_UPDATE_ENABLED=true`
    + If you hit the database connection limit, try enabling this.
13. `BATCH_UPDATE_INTERVAL=5`: interval of batch update aggregation, in seconds, default `5`.
    + Example: `BATCH_UPDATE_INTERVAL=5`
14. Request rate limits:
    + `GLOBAL_API_RATE_LIMIT`: global API rate limit (excluding relay requests), max requests per IP per 3 minutes, default `180`.
    + `GLOBAL_WEB_RATE_LIMIT`: global Web rate limit, max requests per IP per 3 minutes, default `60`.
15. Tokenizer cache settings:
    + `TIKTOKEN_CACHE_DIR`: the program downloads common token encodings (e.g., `gpt-3.5-turbo`) from the internet at startup; in unstable or offline environments this may cause startup issues. Configure this directory to cache data and migrate to offline environments.
    + `DATA_GYM_CACHE_DIR`: currently behaves like `TIKTOKEN_CACHE_DIR` but with lower priority.
16. `RELAY_TIMEOUT`: relay timeout, in seconds, no timeout by default.
17. `RELAY_PROXY`: uses the given proxy to request APIs when set.
18. `USER_CONTENT_REQUEST_TIMEOUT`: timeout for downloading user-uploaded content, in seconds.
19. `USER_CONTENT_REQUEST_PROXY`: uses the given proxy for user-uploaded content (e.g., images) when set.
20. `SQLITE_BUSY_TIMEOUT`: SQLite lock wait timeout, in milliseconds, default `3000`.
21. `GEMINI_SAFETY_SETTING`: Gemini safety setting, default `BLOCK_NONE`.
22. `GEMINI_VERSION`: Gemini version used by One API, default `v1`.
23. `THEME`: system theme, default `default`; see [here](./web/README.md) for options.
24. `ENABLE_METRIC`: whether to disable channels based on request success rate; disabled by default. Values: `true` / `false`.
25. `METRIC_QUEUE_SIZE`: success-rate statistics queue size, default `10`.
26. `METRIC_SUCCESS_RATE_THRESHOLD`: success-rate threshold, default `0.8`.
27. `INITIAL_ROOT_TOKEN`: if set, a root user token with this value is created automatically on first startup.
28. `INITIAL_ROOT_ACCESS_TOKEN`: if set, a root user system-management token with this value is created automatically on first startup.
29. `ENFORCE_INCLUDE_USAGE`: whether to force returning `usage` in stream mode; disabled by default. Values: `true` / `false`.
30. `TEST_PROMPT`: the user prompt when testing models, default `Print your model name exactly and do not output without any other text.`.

### Command Line Parameters
1. `--port <port_number>`: port the server listens on, default `3000`.
   + Example: `--port 3000`
2. `--log-dir <log_dir>`: log directory; if unset, logs are saved to the `logs` folder of the working directory.
   + Example: `--log-dir ./logs`
3. `--version`: print the version and exit.
4. `--help`: show usage help and parameter descriptions.

## Demo
### Online Demo
Note: this demo site does not provide external services:
https://openai.justsong.cn

### Screenshots
![channel](https://user-images.githubusercontent.com/39998050/233837954-ae6683aa-5c4f-429f-a949-6645a83c9490.png)
![token](https://user-images.githubusercontent.com/39998050/233837971-dab488b7-6d96-43af-b640-a168e8d1c9bf.png)

## FAQ
1. What is quota? How is it calculated? Does One API have quota calculation issues?
   + Quota = group ratio * model ratio * (prompt tokens + completion tokens * completion ratio)
   + The completion ratio is fixed at 1.33 for GPT3.5 and 2 for GPT4, consistent with the official rates.
   + In non-stream mode, the official API returns total tokens consumed, but note that prompt and completion have different consumption ratios.
   + One API's default ratios are the official ones, already adjusted.
2. Why does it say insufficient quota when my account has enough?
   + Check your token quota — it is separate from the account quota.
   + Token quota is only a max usage limit set by the user and can be freely configured.
3. "No available channel"?
   + Check the user group and channel group settings.
   + And the channel's model settings.
4. Channel test error: `invalid character '<' looking for beginning of value`
   + The response is not valid JSON but an HTML page.
   + Most likely your deployment's IP or proxy node is blocked by CloudFlare.
5. ChatGPT Next Web error: `Failed to fetch`
   + Do not set `BASE_URL` when deploying.
   + Check that your interface address and API Key are correct.
   + Check whether HTTPS is enabled; browsers block HTTP requests from HTTPS domains.
6. Error: `当前分组负载已饱和，请稍后再试` (current group load is saturated, please try later)
   + The upstream channel returned 429.
7. Will I lose data after upgrading?
   + No, if you use MySQL.
   + With SQLite, mount a volume to persist the one-api.db file per the deployment command; otherwise data is lost after a container restart.
8. Do I need to change the database before upgrading?
   + Generally no; the system adjusts automatically on initialization.
   + If needed, it will be noted in the changelog with a script.
9. Error after manually modifying the database: `数据库一致性已被破坏，请联系管理员` (database consistency has been broken, contact admin)?
   + This is detected when some channel ids in the ability table do not exist — most likely you deleted records from the channel table without cleaning up invalid channels in the ability table.
   + Every model supported by a channel needs a dedicated ability table record indicating that the channel supports that model.

## Related Projects
* [FastGPT](https://github.com/labring/FastGPT): knowledge base QA system based on LLMs
* [ChatGPT Next Web](https://github.com/Yidadaa/ChatGPT-Next-Web): one-click cross-platform ChatGPT app
* [VChart](https://github.com/VisActor/VChart): not just an out-of-the-box multi-terminal chart library, but a vivid and flexible data storyteller
* [VMind](https://github.com/VisActor/VMind): not just automatic, but smart. Open-source intelligent visualization solution
* [CherryStudio](https://github.com/CherryHQ/cherry-studio): cross-platform AI client with multi-provider integration and local knowledge base support

## Note

This project is open-sourced under the MIT license. **On that basis**, attribution and a link to this project must be kept at the bottom of the page. If you do not want to keep the attribution, you must first obtain authorization.

The same applies to projects derived from this one.

Under the MIT license, users bear the risks and responsibilities of using this project; the developers of this open-source project are not liable.
