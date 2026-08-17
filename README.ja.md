<p align="right">
    <a href="./README.md">中文</a> | <a href="./README.en.md">English</a> | <strong>日本語</strong>
</p>


<p align="center">
  <a href="https://github.com/hanyuestar/one-api"><img src="https://raw.githubusercontent.com/songquanpeng/one-api/main/web/default/public/logo.png" width="150" height="150" alt="one-api logo"></a>
</p>

<div align="center">

# One API

_✨ オープンソースの OpenAI API 管理＆配布システム、画像生成に対応 ✨_

> このリポジトリは [songquanpeng/one-api](https://github.com/songquanpeng/one-api) をベースに保守されており、阿里百炼＆火山エンジンの画像生成サポートを追加し、ghcr.io と Docker Hub の両方にプッシュしています。

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
  <a href="#deployment">デプロイ</a>
  ·
  <a href="#usage">使用方法</a>
  ·
  <a href="https://github.com/hanyuestar/one-api/issues">意見・フィードバック</a>
  ·
  <a href="https://github.com/hanyuestar/one-api/wiki">Wiki</a>
  ·
  <a href="#faq">FAQ</a>
</p>

> [!NOTE]
> このプロジェクトはオープンソースです。利用者は OpenAI の[利用規約](https://openai.com/policies/terms-of-use)および**法令・規制**を遵守し、違法な目的に使用してはなりません。
>
> [《生成式人工智能服务管理暂行办法》](http://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm)の要求に基づき、中国本土の公衆に対して未登録の生成 AI サービスを提供しないでください。

> [!NOTE]
> 本リポジトリの Docker イメージ：
> - GitHub Container Registry: `ghcr.io/hanyuestar/one-api:latest`
> - Docker Hub: `kyson666/one-api:latest`
>
> 上流のオリジナルイメージ：[justsong/one-api](https://hub.docker.com/repository/docker/justsong/one-api) または [ghcr.io/songquanpeng/one-api](https://github.com/songquanpeng/one-api/pkgs/container/one-api)

> [!WARNING]
> root ユーザーで初回ログイン後、必ずデフォルトパスワード `123456` を変更してください！

## 更新履歴

### v1.0.6（2026-08-17）

**バグ修正**

- **Anthropic / AWS Bedrock Claude のキャッシュ課金の大幅な過少請求を修正**：Anthropic の `input_tokens` は `cache_read`/`cache_creation` を含みません（別々に報告されます）。従来の課金式は OpenAI の仕様（`prompt_tokens` はキャッシュ済みトークンを含む）を前提としていたため、キャッシュトークンが二重に差し引かれ、キャッシュを利用するすべての Claude リクエストで約 60% 過少請求されていました。キャッシュ読み取り/書き込みトークンを `PromptTokens` に統合し、OpenAI の仕様に合わせました（ストリーミング/非ストリーミング両方修正）。
- **一般ユーザーが任意のチャンネルを強制指定できる権限昇格を修正（セキュリティ）**：`/v1/oneapi/proxy/:channelid/*` ルートは、従来は任意の認証済みトークンで特定チャンネルを強制指定でき、グループ/モデル割り当てを迂回し、管理者チャンネルの利用や権限外モデルの呼び出しリスクがありました。トークンキーのサフィックス規則と同様に、チャンネル指定は管理者のみに制限しました。
- **防御的クランプがキャッシュ統計データを改ざんする問題を修正**：キャッシュトークンが入力トークン総数を超える場合、防御的フォールバックは課金計算のみに作用し、DB に記録されたキャッシュヒット/書き込み統計を書き換えなくなりました。
- **クォータ事前消費の並行レース（TOCTOU）を修正**：トークン/ユーザーのクォータ事前引き落としをアトミックな条件付き更新（`WHERE remain_quota >= ?` + 影響行数チェック）に変更し、高並行時のマイナス超過を防止しました。
- **API トークンキーの弱い乱数を修正**：トークンキーを `crypto/rand` による暗号学的に安全な乱数生成に変更（時間シードの `math/rand` を廃止）、先頭 16 文字の予測可能性を解消しました。
- **セッション型アサーションの panic を修正**：認証ミドルウェアで型アサーションに `ok` チェックを追加し、不正なセッションで panic しなくなりました。
- **ツール呼び出し引数の解析を修正**：Anthropic アダプタの `Arguments` 型アサーションに保護を追加し、JSON 解析失敗は黙って無視せずログに記録します。

**機能改善**

- **Air テーマのチャンネル表に「グループ」列を復活**：default/berry テーマと揃え、チャンネルの所属グループを確認できるようにしました。
- **`/chat` デッドルートを削除**：default/air テーマに残っていた `/chat` ルートと air サイドバーの孤児マッピングを削除し、berry テーマと一致させました。
- **キャッシュフィールドマッピングを集約**：OpenAI 互換チャンネルのキャッシュヒットフィールドのマッピングを課金フォールバックロジックに一本化し、重複を解消しました。

### v1.0.5（2026-08-14）

**機能改善**

- **チャット機能を削除**：本イメージは純粋な AI インターフェース管理＆配布プラットフォームとして位置づけ、3 テーマ（default/air/berry）のトークンページのチャット入口、チャットクライアントメニュー（ChatGPT Next Web / AMA / OpenCat / LobeChat 等）、チャットリンク設定、独立した `/chat` 埋め込みページを削除し、コアの配布機能に集中します。
- **キャッシュヒット課金を追加**：入力トークンを「キャッシュヒット（読み取り）」と「キャッシュ書き込み」で差別化課金します。キャッシュヒットは割引係数（OpenAI 0.5、Anthropic 0.1、DeepSeek 0.1 など内蔵）、キャッシュ書き込みは割増係数（Anthropic 1.25）で課金されます。「キャッシュヒット倍率」「キャッシュ書き込み倍率」設定（モデル倍率と同じ JSON 編集スタイル）を追加し、管理者がカスタマイズ可能。未設定モデルは通常入力課金にフォールバックします。
- **ログフィールド名を変更**：ログページの「プロンプト / 補完」列を「入力 / 出力」に改名し、入力列にキャッシュヒット部分を表示（例：`1000（キャッシュヒット 200）`）。
- **キャッシュデータフォールバック**：OpenAI 互換（`prompt_tokens_details.cached_tokens`、DeepSeek `prompt_cache_hit_tokens`）と Anthropic（`cache_read_input_tokens` / `cache_creation_input_tokens`）の解析層でキャッシュデータを抽出。キャッシュフィールドを返さないチャンネルは通常入力課金にフォールバックし、既存の課金ロジックに影響しません。

### v1.0.4（2026-08-14）

**バグ修正**

- トークンページの「使用済みクォータ」が常に 0 になる問題を修正。原因：`PreConsumeTokenQuota` / `PostConsumeTokenQuota` が無制限トークン（`UnlimitedQuota=true`）で `used_quota` の累積をスキップしていました。無制限トークン用に `used_quota` を個別に書き込むようにし、制限付きトークンの動作には影響しません。

### v1.0.3（2026-08-11）

**バグ修正**

- 阿里百炼チャンネル（type 49）のテキスト会話が `usage is nil` を返す問題を修正。従来このチャンネルの独立アダプタ `DoResponse` が usage を正しく抽出できず、**リクエストが課金されず消費ログも記録されませんでした**。OpenAI 標準の Handler/StreamHandler を再利用するようにし、画像生成は影響を受けません。

**機能改善**

- **berry テーマ**に欠けていた 5 つのチャンネル登録を補完：百度文心千帆 V2、訊飛星火 V2、阿里百炼、OpenAI 互換、Gemini (OpenAI)。3 テーマ（default/air/berry）のチャンネルタイプが完全に揃いました（51 種）。
- go.mod のバージョン宣言を `1.22` に統一し、Docker ビルド環境と一致させました。
- berry テーマの `ChannelConstants.js` で Replicate チャンネルオブジェクトのキー不一致を修正。

### v1.0.2（2026-08-10）

- default テーマのフロントエンドビルド失敗を修正：eslint 設定から `react-app/jest` 参照を削除（`jest/globals` 環境キーは react-scripts 5 で認識されないため）。

### v1.0.1（2026-08-10）

- デフォルトバージョン番号を `v0.0.0` から `v1.0.0` に修正し、リリースタグと一致させました。
- Wiki ドキュメント（`docs/wiki/`）を追加：プロジェクト概要、Docker デプロイガイド、モデル倍率の説明。

### v1.0.0（2026-08-10）

**Docker デプロイ改善**

- ベースイメージのバージョンを固定：Node 20 / Go 1.22 / Alpine 3.20、バージョン漂流を防止。
- `.dockerignore` を追加し、node_modules・ビルド成果物・DB ファイルなどを除外、イメージサイズを大幅削減。
- マルチステージビルド + BuildKit キャッシュマウントで再ビルドを高速化。
- 実行時は非 root ユーザー（appuser）、HTTP ヘルスチェック内蔵。
- `docker-compose.yml` はゼロ設定で実行可能（SQLite モード）、本番はコメントに従いシークレットを変更。
- `.env.example` テンプレートを追加。

**モデル倍率更新**

- 過時/誤りの倍率を修正：`gpt-4o`（$5/M→$2.5/M）、`o3-mini`（$3/M→$1.1/M）、`qwen2.5-32b/3b` など。
- 50+ の一般モデルの倍率を追加（GPT-4.1/5、Claude 4.x、Gemini 2.5/3、DeepSeek V4、GLM-4.5/4.6/4.7、qwen3、豆包 Seed シリーズ、Kimi K2 など）。

## 特徴
1. 複数の大型モデルをサポート:
   + [x] [OpenAI ChatGPT シリーズモデル](https://platform.openai.com/docs/guides/gpt/chat-completions-api) ([Azure OpenAI API](https://learn.microsoft.com/en-us/azure/ai-services/openai/reference) をサポート)
   + [x] [Anthropic Claude シリーズモデル](https://anthropic.com) (AWS Claude をサポート)
   + [x] [Google PaLM2/Gemini シリーズモデル](https://developers.generativeai.google)
   + [x] [Mistral シリーズモデル](https://mistral.ai/)
   + [x] [字节跳动豆包大模型（火山引擎）](https://www.volcengine.com/experience/ark?utm_term=202502dsinvite&ac=DSASUQY5&rc=2QXCA1VI)
   + [x] [百度文心一言シリーズモデル](https://cloud.baidu.com/doc/WENXINWORKSHOP/index.html)
   + [x] [阿里通義千問シリーズモデル](https://help.aliyun.com/document_detail/2400395.html)
   + [x] [訊飛星火認知大モデル](https://www.xfyun.cn/doc/spark/Web.html)
   + [x] [智谱 ChatGLM シリーズモデル](https://bigmodel.cn)
   + [x] [360 智脳](https://ai.360.cn)
   + [x] [腾讯混元大模型](https://cloud.tencent.com/document/product/1729)
   + [x] [Moonshot AI](https://platform.moonshot.cn/)
   + [x] [百川大模型](https://platform.baichuan-ai.com)
   + [x] [MINIMAX](https://api.minimax.chat/)
   + [x] [Groq](https://wow.groq.com/)
   + [x] [Ollama](https://github.com/ollama/ollama)
   + [x] [零一万物](https://platform.lingyiwanwu.com/)
   + [x] [階跃星辰](https://platform.stepfun.com/)
   + [x] [Coze](https://www.coze.com/)
   + [x] [Cohere](https://cohere.com/)
   + [x] [DeepSeek](https://www.deepseek.com/)
   + [x] [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
   + [x] [DeepL](https://www.deepl.com/)
   + [x] [together.ai](https://www.together.ai/)
   + [x] [novita.ai](https://www.novita.ai/)
   + [x] [硅基流動 SiliconCloud](https://cloud.siliconflow.cn/i/rKXmRobW)
   + [x] [xAI](https://x.ai/)
2. ミラーサイトおよび多くの[サードパーティプロキシサービス](https://iamazing.cn/page/openai-api-third-party-services)の設定をサポート。
3. **ロードバランシング**による複数チャンネルへのアクセスをサポート。
4. **ストリームモード**をサポートし、ストリーミングでタイプライター効果を実現。
5. **マルチマシンデプロイ**をサポート。[詳細はこちら](#マルチマシンデプロイ)。
6. **トークン管理**をサポート：トークンの有効期限、クォータ、許可 IP 範囲、許可モデルを設定可能。
7. **兑换码（引き換えコード）管理**をサポート：一括生成・エクスポート、アカウントのチャージに使用可能。
8. **チャンネル管理**をサポート：チャンネルの一括作成。
9. **ユーザーグループ**と**チャンネルグループ**をサポート：グループごとに異なる倍率を設定可能。
10. チャンネルごとに**モデルリスト**の設定をサポート。
11. **クォータ明細の表示**をサポート。
12. **ユーザー招待報酬**をサポート。
13. クォータを米ドル単位で表示可能。
14. お知らせの公開、チャージリンクの設定、新規ユーザーの初期クォータ設定をサポート。
15. モデルマッピングをサポートし、ユーザーのリクエストモデルをリダイレクト。必要な場合以外は設定しないでください。設定するとリクエストボディが再構築され直接透過ではなくなり、未対応のフィールドが渡せなくなる可能性があります。
16. 失敗時の自動リトライをサポート。
17. 画像生成インターフェースをサポート（DALL-E / 通義万相 / 火山 Seedream / CogView / Replicate）。[[Image-Generation]] 参照。
18. [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/providers/openai/) をサポート：チャンネル設定のプロキシ欄に `https://gateway.ai.cloudflare.com/v1/ACCOUNT_TAG/GATEWAY/openai` を入力。
19. 豊富な**カスタマイズ**設定をサポート：
    1. システム名、ロゴ、フッターのカスタマイズ。
    2. ホームページとアバウトページのカスタマイズ：HTML & Markdown コード、または iframe で別ページを埋め込み。
20. システムアクセストークンによる管理 API 呼び出しをサポートし、**二度開発なしで** One API を拡張・カスタマイズ可能。[API ドキュメント](./docs/API.md) 参照。
21. Cloudflare Turnstile ユーザー検証をサポート。
22. ユーザー管理と**多様なログイン/登録方式**をサポート：
    + メール登録/ログイン（登録メールホワイトリスト対応）およびメールによるパスワードリセット。
    + [飞书（Feishu/Lark）認可ログイン](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/authorize/get)（[One API の実装詳細はこちら](https://iamazing.cn/page/feishu-oauth-login)）。
    + [GitHub 認可ログイン](https://github.com/settings/applications/new)。
    + 微信公衆号認可（別途 [WeChat Server](https://github.com/songquanpeng/wechat-server) のデプロイが必要）。
23. テーマ切り替えをサポート：環境変数 `THEME` で設定、デフォルトは `default`。テーマ追加の PR 歓迎。[詳細はこちら](./web/README.md)。
24. [Message Pusher](https://github.com/songquanpeng/message-pusher) と連携し、アラートを各種 App にプッシュ可能。
25. 🆕 **阿里百炼（通義万相）画像生成** — チャンネルタイプ 49、wanx-v1 / stable-diffusion シリーズに対応。
26. 🆕 **火山引擎（Seedream）画像生成** — チャンネルタイプ 40、Seedream 4.0/4.5/5.0 シリーズに対応。
27. 🆕 **Air テーマのチャンネルタイプ補完** — 百度 V2、訊飛 V2、阿里百炼、OpenAI 互換、Gemini OpenAI の 5 タイプを追加。

## デプロイメント
### Docker デプロイメント
```shell
# ghcr.io イメージを使用（推奨）：
docker run --name one-api -d --restart always -p 3000:3000 -e TZ=Asia/Shanghai -v /home/ubuntu/data/one-api:/data ghcr.io/hanyuestar/one-api:latest
# Docker Hub イメージ：
docker run --name one-api -d --restart always -p 3000:3000 -e TZ=Asia/Shanghai -v /home/ubuntu/data/one-api:/data kyson666/one-api:latest
# MySQL を使用：
docker run --name one-api -d --restart always -p 3000:3000 -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" -e TZ=Asia/Shanghai -v /home/ubuntu/data/one-api:/data ghcr.io/hanyuestar/one-api:latest
```

`-p 3000:3000` の最初の `3000` はホスト側のポートです。必要に応じて変更してください。

データとログはホストの `/home/ubuntu/data/one-api` ディレクトリに保存されます。ディレクトリが存在し書き込み権限があることを確認するか、適切なディレクトリに変更してください。

起動に失敗する場合は `--privileged=true` を追加してください。参考：https://github.com/songquanpeng/one-api/issues/482 。

上のイメージをプルできない場合は、Docker Compose デプロイ（下記）または上流のオリジナルイメージを試してください。

並行度が高い場合は**必ず** `SQL_DSN` を設定してください。詳細は下記の[環境変数](#環境変数)を参照。

更新コマンド：`docker run --rm -v /var/run/docker.sock:/var/run/docker.sock containrrr/watchtower -cR`

Nginx の参考設定：
```
server{
   server_name openai.justsong.cn;  # 実際のドメインに変更

   location / {
          client_max_body_size  64m;
          proxy_http_version 1.1;
          proxy_pass http://localhost:3000;  # 実際のポートに変更
          proxy_set_header Host $host;
          proxy_set_header X-Forwarded-For $remote_addr;
          proxy_cache_bypass $http_upgrade;
          proxy_set_header Accept-Encoding gzip;
          proxy_read_timeout 300s;  # GPT-4 は長いタイムアウトが必要、適宜調整
   }
}
```

その後、Let's Encrypt の certbot で HTTPS を設定：
```bash
# Ubuntu に certbot をインストール:
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
# 証明書の生成と Nginx 設定の変更
sudo certbot --nginx
# プロンプトに従う
# Nginx を再起動
sudo service nginx restart
```

初期アカウントはユーザー名 `root`、パスワード `123456` です。

### 宝塔（Baota）パネルでのワンクリックデプロイ
1. 宝塔パネル 9.2.0 以上を[宝塔パネル公式サイト](https://www.bt.cn/new/download.html?r=dk_oneapi)からインストール（正式版スクリプトを選択）。
2. ログイン後、左メニューの `Docker` をクリック。初回は `Docker` サービスのインストールが促されるので、すぐにインストールして手順に従います。
3. インストール後、アプリストアで `One-API` を検索してインストールし、ドメインなどの基本情報を設定すれば完了です。

### Docker Compose デプロイメント

リポジトリに同梱の `docker-compose.yml` でワンクリックデプロイ（MySQL + Redis + One API）：

```shell
# ghcr.io イメージを使用（デフォルト）
docker compose up -d

# Docker Hub イメージを使用
IMAGE=kyson666/one-api docker compose up -d
```

### マニュアルデプロイ
1. [本リポジトリの Releases](https://github.com/hanyuestar/one-api) から実行ファイルをダウンロードするか、ソースからビルド：
   ```shell
   git clone https://github.com/hanyuestar/one-api.git

   # フロントエンドをビルド
   cd one-api/web/default
   npm install
   npm run build

   # バックエンドをビルド
   cd ../..
   go mod download
   go build -ldflags "-s -w" -o one-api
   ````
2. 実行：
   ```shell
   chmod u+x one-api
   ./one-api --port 3000 --log-dir ./logs
   ```
3. [http://localhost:3000/](http://localhost:3000/) にアクセスしてログイン。初期アカウントは `root`、パスワードは `123456` です。

より詳細なデプロイチュートリアルは[こちら](https://iamazing.cn/page/how-to-deploy-a-website)を参照。

### マルチマシンデプロイ
1. すべてのサーバーで `SESSION_SECRET` を同じ値に設定します。
2. `SQL_DSN` を必ず設定し、SQLite ではなく MySQL を使用、全サーバーが同じデータベースに接続します。
3. すべてのスレーブサーバーで `NODE_TYPE` を `slave` に設定。未設定の場合はマスターとして扱われます。
4. `SYNC_FREQUENCY` を設定するとサーバーは定期的にデータベースから設定を同期します。リモートデータベース使用時は、マスター/スレーブ問わずこの設定と Redis 有効化を推奨。
5. スレーブサーバーは任意で `FRONTEND_BASE_URL` を設定し、ページリクエストをマスターサーバーにリダイレクトできます。
6. 各スレーブサーバーに**別々に** Redis を導入し、`REDIS_CONN_STRING` を設定。キャッシュが有効な間はデータベースにアクセスせず、遅延を減らせます（Redis クラスタ/センチネルは環境変数の説明を参照）。
7. マスターサーバーもデータベース遅延が高い場合は、Redis を有効化し `SYNC_FREQUENCY` を設定して定期的に設定を同期します。

環境変数の詳細な使い方は[こちら](#環境変数)を参照。

### 宝塔デプロイチュートリアル

[#175](https://github.com/songquanpeng/one-api/issues/175) を参照。

デプロイ後に空白ページになる場合は [#97](https://github.com/songquanpeng/one-api/issues/97) を参照。

### One API と連携するサードパーティサービスのデプロイ
> サンプル追加の PR 歓迎です。

#### ChatGPT Next Web
プロジェクトページ：https://github.com/Yidadaa/ChatGPT-Next-Web

```bash
docker run --name chat-next-web -d -p 3001:3000 yidadaa/chatgpt-next-web
```

ポート番号を変更し、ページ上でインターフェースアドレス（例：https://openai.justsong.cn/ ）と API Key を設定してください。

#### ChatGPT Web
プロジェクトページ：https://github.com/Chanzhaoyu/chatgpt-web

```bash
docker run --name chatgpt-web -d -p 3002:3002 -e OPENAI_API_BASE_URL=https://openai.justsong.cn -e OPENAI_API_KEY=sk-xxx chenzhaoyu94/chatgpt-web
```

ポート番号、`OPENAI_API_BASE_URL`、`OPENAI_API_KEY` を変更してください。

#### QChatGPT - QQ ボット
プロジェクトページ：https://github.com/RockChinQ/QChatGPT

[ドキュメント](https://qchatgpt.rockchin.top)に従ってデプロイ後、`data/provider.json` の `requester.openai-chat-completions.base-url` を One API インスタンスのアドレスに設定し、`keys.openai` グループに API Key を記入、`model` を使用したいモデル名に設定します。

実行中は `!model` コマンドで利用可能なモデルを確認・切り替えできます。

### サードパーティプラットフォームへのデプロイ
<details>
<summary><strong>Sealos へのデプロイ</strong></summary>
<div>

> Sealos のサーバーは海外にあり、ネットワークの追加対応は不要。高並行＆動的スケーリングに対応。

下のボタンでワンクリックデプロイ（デプロイ後に 404 が出る場合は 3〜5 分お待ちください）：

[![Deploy-on-Sealos.svg](https://raw.githubusercontent.com/labring-actions/templates/main/Deploy-on-Sealos.svg)](https://cloud.sealos.io/?openapp=system-fastdeploy?templateName=one-api)

</div>
</details>

<details>
<summary><strong>Zeabur へのデプロイ</strong></summary>
<div>

> Zeabur のサーバーは海外にあり、ネットワーク問題を自動解決。無料枠も個人利用には十分です。

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/7Q0KO3)

1. まずコードを fork します。
2. [Zeabur](https://zeabur.com?referralCode=songquanpeng) にログインし、コンソールに入ります。
3. 新しい Project を作成し、Service -> Add Service で Marketplace を選択、MySQL を選んで接続パラメータ（ユーザー名、パスワード、アドレス、ポート）を控えます。
4. 接続パラメータをコピーし、```create database `one-api` ``` を実行してデータベースを作成します。
5. Service -> Add Service で Git を選択（初回は認可が必要）、fork したリポジトリを選択します。
6. Deploy が自動開始されるので先にキャンセル。下の Variable で `PORT` = `3000` を追加し、さらに `SQL_DSN` = `<username>:<password>@tcp(<addr>:<port>)/one-api` を追加して保存します。`SQL_DSN` を設定しないとデータが永続化されず、再デプロイでデータが失われます。
7. Redeploy を選択します。
8. 下の Domains で適切なドメイン接頭辞（例："my-one-api"）を選ぶと、最終ドメインは "my-one-api.zeabur.app" になります。独自ドメインの CNAME も可能です。
9. デプロイ完了を待ち、生成されたドメインで One API にアクセスします。

</div>
</details>

<details>
<summary><strong>Render へのデプロイ</strong></summary>
<div>

> Render は無料枠を提供。カード登録でさらに枠が増えます。

Render は fork 不要で docker イメージを直接デプロイ可能：https://dashboard.render.com

</div>
</details>

## コンフィグ
システムは初期状態でそのまま使えます。

環境変数またはコマンドラインパラメータで設定できます。

起動後、`root` ユーザーでログインして追加設定を行います。

**注**：設定項目の意味が不明な場合は、一時的に値を削除するとヒントテキストが表示されます。

## 使用方法
`渠道（チャンネル）`ページで API Key を追加し、`令牌（トークン）`ページでアクセストークンを作成します。

その後、トークンで One API にアクセスできます。[OpenAI API](https://platform.openai.com/docs/api-reference/introduction) と同じ使い方です。

OpenAI API を使う各所で、API Base を One API のデプロイアドレス（例：`https://openai.justsong.cn`）に設定し、API Key には One API で生成したトークンを使用します。

API Base の正確な形式は使用するクライアントによって異なります。

例：OpenAI 公式ライブラリの場合
```bash
OPENAI_API_KEY="sk-xxxxxx"
OPENAI_API_BASE="https://<HOST>:<PORT>/v1"
```

```mermaid
graph LR
    A(ユーザー)
    A --->|One API が配布したキーでリクエスト| B(One API)
    B -->|中継リクエスト| C(OpenAI)
    B -->|中継リクエスト| D(Azure)
    B -->|中継リクエスト| E(その他 OpenAI API 形式の下流チャンネル)
    B -->|中継してリクエスト/レスポンスを変換| F(非 OpenAI API 形式の下流チャンネル)
```

トークンの後ろにチャンネル ID を付けることで、このリクエストを処理するチャンネルを指定できます。例：`Authorization: Bearer ONE_API_KEY-CHANNEL_ID`。
注：チャンネル ID を指定できるのは管理者ユーザーが作成したトークンのみです。

付けない場合はロードバランシングで複数チャンネルを使用します。

### 環境変数
> One API は `.env` ファイルから環境変数を読み込めます。`.env.example` を参照し、使用時に `.env` にリネームしてください。
1. `REDIS_CONN_STRING`：設定すると Redis をキャッシュとして使用します。
   + 例：`REDIS_CONN_STRING=redis://default:redispw@localhost:49153`
   + データベースアクセスの遅延が十分低い場合は Redis を有効にする必要はありません。有効にするとデータ遅延が発生することがあります。
   + センチネル/クラスタモードを使用する場合：
     + 環境変数をノードリストに設定します。例：`localhost:49153,localhost:49154,localhost:49155`。
     + さらに以下の環境変数も設定：
       + `REDIS_PASSWORD`：Redis クラスタ/センチネルモードのパスワード。
       + `REDIS_MASTER_NAME`：Redis センチネルモードのマスターノード名。
2. `SESSION_SECRET`：設定すると固定のセッションキーを使用。再起動後もログインユーザーの cookie が有効のままになります。
   + 例：`SESSION_SECRET=random_string`
3. `SQL_DSN`：設定すると SQLite ではなく指定データベースを使用。MySQL または PostgreSQL を使用してください。
   + 例：
     + MySQL：`SQL_DSN=root:123456@tcp(localhost:3306)/oneapi`
     + PostgreSQL：`SQL_DSN=postgres://postgres:123456@localhost:5432/oneapi`（対応調整中、フィードバック歓迎）
   + 事前にデータベース `oneapi` を作成してください。テーブルはプログラムが自動生成します。
   + ローカルデータベースの場合：デプロイコマンドに `--network="host"` を追加すると、コンテナ内からホスト上の MySQL にアクセスできます。
   + クラウドデータベースで認証が必要な場合：接続パラメータに `?tls=skip-verify` を追加してください。
   + データベース設定に応じて以下のパラメータを調整（またはデフォルトのまま）：
     + `SQL_MAX_IDLE_CONNS`：最大アイドル接続数、デフォルト `100`。
     + `SQL_MAX_OPEN_CONNS`：最大オープン接続数、デフォルト `1000`。
       + `Error 1040: Too many connections` が出る場合はこの値を小さくしてください。
     + `SQL_CONN_MAX_LIFETIME`：接続の最大ライフタイム、デフォルト `60` 分。
4. `LOG_SQL_DSN`：設定すると `logs` テーブルに独立したデータベースを使用。MySQL または PostgreSQL。
5. `FRONTEND_BASE_URL`：設定するとページリクエストを指定アドレスにリダイレクト。スレーブサーバーのみ設定。
   + 例：`FRONTEND_BASE_URL=https://openai.justsong.cn`
6. `MEMORY_CACHE_ENABLED`：メモリキャッシュを有効化。ユーザークォータの更新に遅延が生じます。値：`true` / `false`、デフォルト `false`。
   + 例：`MEMORY_CACHE_ENABLED=true`
7. `SYNC_FREQUENCY`：キャッシュ有効時にデータベースから設定を同期する頻度（秒）、デフォルト `600` 秒。
   + 例：`SYNC_FREQUENCY=60`
8. `NODE_TYPE`：ノードタイプ。値：`master` / `slave`、デフォルト `master`。
   + 例：`NODE_TYPE=slave`
9. `CHANNEL_UPDATE_FREQUENCY`：設定するとチャンネル残高を定期更新（分）。未設定なら更新しません。
   + 例：`CHANNEL_UPDATE_FREQUENCY=1440`
10. `CHANNEL_TEST_FREQUENCY`：設定するとチャンネルを定期チェック（分）。未設定ならチェックしません。
    + 例：`CHANNEL_TEST_FREQUENCY=1440`
11. `POLLING_INTERVAL`：チャンネル残高一括更新・可用性テスト時のリクエスト間隔（秒）、デフォルトは間隔なし。
    + 例：`POLLING_INTERVAL=5`
12. `BATCH_UPDATE_ENABLED`：データベース一括更新集約を有効化。ユーザークォータの更新に遅延が生じます。値：`true` / `false`、デフォルト `false`。
    + 例：`BATCH_UPDATE_ENABLED=true`
    + データベース接続数が多すぎる場合はこのオプションを試してください。
13. `BATCH_UPDATE_INTERVAL=5`：一括更新集約の間隔（秒）、デフォルト `5`。
    + 例：`BATCH_UPDATE_INTERVAL=5`
14. リクエスト頻度制限：
    + `GLOBAL_API_RATE_LIMIT`：グローバル API レート制限（中継リクエスト除く）、単 IP 3 分間の最大リクエスト数、デフォルト `180`。
    + `GLOBAL_WEB_RATE_LIMIT`：グローバル Web レート制限、単 IP 3 分間の最大リクエスト数、デフォルト `60`。
15. トークナイザーキャッシュ設定：
    + `TIKTOKEN_CACHE_DIR`：デフォルトでは起動時に `gpt-3.5-turbo` 等のトークンエンコーディングをネットからダウンロードします。不安定なネットワークやオフライン環境では起動に問題が出ることがあるため、このディレクトリにキャッシュを設定し、オフライン環境へ移行できます。
    + `DATA_GYM_CACHE_DIR`：現在は `TIKTOKEN_CACHE_DIR` と同じ役割ですが、優先度は低くなります。
16. `RELAY_TIMEOUT`：中継タイムアウト（秒）、デフォルトはタイムアウトなし。
17. `RELAY_PROXY`：設定するとこのプロキシで API をリクエストします。
18. `USER_CONTENT_REQUEST_TIMEOUT`：ユーザーアップロードコンテンツのダウンロードタイムアウト（秒）。
19. `USER_CONTENT_REQUEST_PROXY`：設定するとこのプロキシでユーザーアップロードコンテンツ（画像など）をリクエストします。
20. `SQLITE_BUSY_TIMEOUT`：SQLite ロック待機タイムアウト（ミリ秒）、デフォルト `3000`。
21. `GEMINI_SAFETY_SETTING`：Gemini の安全設定、デフォルト `BLOCK_NONE`。
22. `GEMINI_VERSION`：One API が使用する Gemini バージョン、デフォルト `v1`。
23. `THEME`：システムのテーマ設定、デフォルト `default`。選択肢は[こちら](./web/README.md)を参照。
24. `ENABLE_METRIC`：リクエスト成功率に基づいてチャンネルを無効化するか。デフォルトは無効。値：`true` / `false`。
25. `METRIC_QUEUE_SIZE`：成功率統計キューのサイズ、デフォルト `10`。
26. `METRIC_SUCCESS_RATE_THRESHOLD`：成功率しきい値、デフォルト `0.8`。
27. `INITIAL_ROOT_TOKEN`：設定すると、システム初回起動時にこの値を root ユーザートークンとして自動作成します。
28. `INITIAL_ROOT_ACCESS_TOKEN`：設定すると、システム初回起動時にこの値を root ユーザーのシステム管理トークンとして自動作成します。
29. `ENFORCE_INCLUDE_USAGE`：ストリームモードで usage の返却を強制するか。デフォルトは無効。値：`true` / `false`。
30. `TEST_PROMPT`：モデルテスト時のユーザープロンプト、デフォルト `Print your model name exactly and do not output without any other text.`。

### コマンドラインパラメータ
1. `--port <port_number>`：サーバーのリッスンポート、デフォルト `3000`。
   + 例：`--port 3000`
2. `--log-dir <log_dir>`：ログフォルダ。未設定なら作業ディレクトリの `logs` フォルダに保存。
   + 例：`--log-dir ./logs`
3. `--version`：バージョン番号を表示して終了。
4. `--help`：コマンドの使い方とパラメータ説明を表示。

## デモ
### オンラインデモ
注意：このデモサイトは外部サービスを提供していません：
https://openai.justsong.cn

### スクリーンショット
![channel](https://user-images.githubusercontent.com/39998050/233837954-ae6683aa-5c4f-429f-a949-6645a83c9490.png)
![token](https://user-images.githubusercontent.com/39998050/233837971-dab488b7-6d96-43af-b640-a168e8d1c9bf.png)

## FAQ
1. クォータとは？どう計算する？One API のクォータ計算に問題はある？
   + クォータ = グループ倍率 * モデル倍率 * （プロンプトトークン数 + 補完トークン数 * 補完倍率）
   + 補完倍率は GPT3.5 で固定 1.33、GPT4 で 2、公式と一致しています。
   + 非ストリームモードでは公式 API が消費トークン総数を返しますが、プロンプトと補完の消費倍率が異なる点に注意してください。
   + One API のデフォルト倍率は公式倍率で、すでに調整済みです。
2. アカウントのクォータが十分なのに「クォータ不足」と出るのは？
   + トークンのクォータが十分か確認してください。アカウントのクォータとは別です。
   + トークンクォータはユーザーが設定する最大使用量で、自由に設定できます。
3. 「利用可能なチャンネルがない」と出るのは？
   + ユーザーグループとチャンネルグループの設定を確認してください。
   + チャンネルのモデル設定も確認してください。
4. チャンネルテストエラー：`invalid character '<' looking for beginning of value`
   + 戻り値が有効な JSON ではなく HTML ページであるためです。
   + デプロイサイトの IP またはプロキシノードが CloudFlare にブロックされている可能性が高いです。
5. ChatGPT Next Web エラー：`Failed to fetch`
   + デプロイ時に `BASE_URL` を設定しないでください。
   + インターフェースアドレスと API Key が正しいか確認してください。
   + HTTPS が有効か確認してください。ブラウザは HTTPS ドメイン下の HTTP リクエストをブロックします。
6. エラー：`当前分组负载已饱和，请稍后再试`（グループの負荷が飽和、後で再試行）
   + 上流チャンネルが 429 を返しています。
7. アップグレード後にデータは失われますか？
   + MySQL を使用している場合は失われません。
   + SQLite の場合、デプロイコマンドの通りに volume をマウントして one-api.db を永続化してください。そうしないとコンテナ再起動でデータが失われます。
8. アップグレード前にデータベースの変更は必要ですか？
   + 通常は不要です。システムが初期化時に自動調整します。
   + 必要な場合は更新履歴に記載し、スクリプトを提供します。
9. データベースを手動で変更した後にエラー：`数据库一致性已被破坏，请联系管理员`（データベース整合性が壊れた、管理者に連絡）？
   + ability テーブルに存在しないチャンネル ID のレコードがあることを検出しています。channel テーブルのレコードを削除した際に、ability テーブル内の無効なチャンネルを掃除していない可能性が高いです。
   + 各チャンネルについて、サポートする各モデルには、そのチャンネルがモデルをサポートすることを示す ability テーブルのレコードが必要です。

## 関連プロジェクト
* [FastGPT](https://github.com/labring/FastGPT): LLM 大規模言語モデルに基づくナレッジベース QA システム
* [ChatGPT Next Web](https://github.com/Yidadaa/ChatGPT-Next-Web): ワンクリックで自分のクロスプラットフォーム ChatGPT アプリを
* [VChart](https://github.com/VisActor/VChart): すぐ使えるマルチエンドチャートライブラリであるだけでなく、生き生きとしたデータストーリーテラー
* [VMind](https://github.com/VisActor/VMind): 自動だけでなく、インテリジェント。オープンソースのスマート可視化ソリューション
* [CherryStudio](https://github.com/CherryHQ/cherry-studio): 全プラットフォーム対応の AI クライアント、マルチプロバイダー統合管理、ローカルナレッジベース対応

## 注

このプロジェクトは MIT ライセンスでオープンソース化されています。**その上で**、ページ下部に署名と本プロジェクトへのリンクを必ず残してください。署名を残したくない場合は、事前に許可を得る必要があります。

本プロジェクトをベースにした二次開発プロジェクトにも同様に適用されます。

MIT ライセンスに基づき、利用者は本プロジェクトの使用に伴うリスクと責任を自己負担します。本オープンソースプロジェクトの開発者はこれに関与しません。
