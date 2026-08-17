<p align="right">
    <a href="./README.md">中文</a> | <a href="./README.en.md">English</a> | <strong>日本語</strong>
</p>

<p align="center">
  <a href="https://github.com/songquanpeng/one-api"><img src="https://raw.githubusercontent.com/songquanpeng/one-api/main/web/default/public/logo.png" width="150" height="150" alt="one-api logo"></a>
</p>

<div align="center">

# One API

_✨ 標準的な OpenAI API フォーマットを通じてすべての LLM にアクセスでき、導入と利用が容易です ✨_

</div>

<p align="center">
  <a href="https://raw.githubusercontent.com/songquanpeng/one-api/main/LICENSE">
    <img src="https://img.shields.io/github/license/songquanpeng/one-api?color=brightgreen" alt="license">
  </a>
  <a href="https://github.com/songquanpeng/one-api/releases/latest">
    <img src="https://img.shields.io/github/v/release/songquanpeng/one-api?color=brightgreen&include_prereleases" alt="release">
  </a>
  <a href="https://hub.docker.com/repository/docker/justsong/one-api">
    <img src="https://img.shields.io/docker/pulls/justsong/one-api?color=brightgreen" alt="docker pull">
  </a>
  <a href="https://github.com/songquanpeng/one-api/releases/latest">
    <img src="https://img.shields.io/github/downloads/songquanpeng/one-api/total?color=brightgreen&include_prereleases" alt="release">
  </a>
  <a href="https://goreportcard.com/report/github.com/songquanpeng/one-api">
    <img src="https://goreportcard.com/badge/github.com/songquanpeng/one-api" alt="GoReportCard">
  </a>
</p>

<p align="center">
  <a href="#deployment">デプロイチュートリアル</a>
  ·
  <a href="#usage">使用方法</a>
  ·
  <a href="https://github.com/songquanpeng/one-api/issues">フィードバック</a>
  ·
  <a href="#screenshots">スクリーンショット</a>
  ·
  <a href="https://openai.justsong.cn/">ライブデモ</a>
  ·
  <a href="#faq">FAQ</a>
  ·
  <a href="#related-projects">関連プロジェクト</a>
  ·
  <a href="https://iamazing.cn/page/reward">寄付</a>
</p>

> **警告**: この README は ChatGPT によって翻訳されています。翻訳ミスを発見した場合は遠慮なく PR を投稿してください。

> **注**: Docker からプルされた最新のイメージは、`alpha` リリースかもしれません。安定性が必要な場合は、手動でバージョンを指定してください。

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
   + [x] [Anthropic Claude シリーズモデル](https://anthropic.com)
   + [x] [Google PaLM2/Gemini シリーズモデル](https://developers.generativeai.google)
   + [x] [Baidu Wenxin Yiyuan シリーズモデル](https://cloud.baidu.com/doc/WENXINWORKSHOP/index.html)
   + [x] [Alibaba Tongyi Qianwen シリーズモデル](https://help.aliyun.com/document_detail/2400395.html)
   + [x] [Zhipu ChatGLM シリーズモデル](https://bigmodel.cn)
2. **ロードバランシング**による複数チャンネルへのアクセスをサポート。
3. ストリーム伝送によるタイプライター的効果を可能にする**ストリームモード**に対応。
4. **マルチマシンデプロイ**に対応。[詳細はこちら](#multi-machine-deployment)を参照。
5. トークンの有効期限や使用回数を設定できる**トークン管理**に対応しています。
6. **バウチャー管理**に対応しており、バウチャーの一括生成やエクスポートが可能です。バウチャーは口座残高の補充に利用できます。
7. **チャンネル管理**に対応し、チャンネルの一括作成が可能。
8. グループごとに異なるレートを設定するための**ユーザーグループ**と**チャンネルグループ**をサポートしています。
9. チャンネル**モデルリスト設定**に対応。
10. **クォータ詳細チェック**をサポート。
11. **ユーザー招待報酬**をサポートします。
12. 米ドルでの残高表示が可能。
13. 新規ユーザー向けのお知らせ公開、リチャージリンク設定、初期残高設定に対応。
14. 豊富な**カスタマイズ**オプションを提供します:
    1. システム名、ロゴ、フッターのカスタマイズが可能。
    2. HTML と Markdown コードを使用したホームページとアバウトページのカスタマイズ、または iframe を介したスタンドアロンウェブページの埋め込みをサポートしています。
15. システム・アクセストークンによる管理 API アクセスをサポートする。
16. Cloudflare Turnstile によるユーザー認証に対応。
17. ユーザー管理と複数のユーザーログイン/登録方法をサポート:
    + 電子メールによるログイン/登録とパスワードリセット。
    + [GitHub OAuth](https://github.com/settings/applications/new)。
    + WeChat 公式アカウントの認証（[WeChat Server](https://github.com/songquanpeng/wechat-server)の追加導入が必要）。
18. 他の主要なモデル API が利用可能になった場合、即座にサポートし、カプセル化する。

## デプロイメント
### Docker デプロイメント

デプロイコマンド:
`docker run --name one-api -d --restart always -p 3000:3000 -e TZ=Asia/Shanghai -v /home/ubuntu/data/one-api:/data justsong/one-api`。

コマンドを更新する: `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock containrr/watchtower -cR`。

`-p 3000:3000` の最初の `3000` はホストのポートで、必要に応じて変更できます。

データはホストの `/home/ubuntu/data/one-api` ディレクトリに保存される。このディレクトリが存在し、書き込み権限があることを確認する、もしくは適切なディレクトリに変更してください。

Nginxリファレンス設定:
```
server{
   server_name openai.justsong.cn;  # ドメイン名は適宜変更

   location / {
          client_max_body_size  64m;
          proxy_http_version 1.1;
          proxy_pass http://localhost:3000;  # それに応じてポートを変更
          proxy_set_header Host $host;
          proxy_set_header X-Forwarded-For $remote_addr;
          proxy_cache_bypass $http_upgrade;
          proxy_set_header Accept-Encoding gzip;
          proxy_read_timeout 300s;  # GPT-4 はより長いタイムアウトが必要
   }
}
```

次に、Let's Encrypt certbot を使って HTTPS を設定します:
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

初期アカウントのユーザー名は `root` で、パスワードは `123456` です。

### マニュアルデプロイ
1. [GitHub Releases](https://github.com/songquanpeng/one-api/releases/latest) から実行ファイルをダウンロードする、もしくはソースからコンパイルする:
   ```shell
   git clone https://github.com/songquanpeng/one-api.git

   # フロントエンドのビルド
   cd one-api/web/default
   npm install
   npm run build

   # バックエンドのビルド
   cd ../..
   go mod download
   go build -ldflags "-s -w" -o one-api
   ```
2. 実行:
   ```shell
   chmod u+x one-api
   ./one-api --port 3000 --log-dir ./logs
   ```
3. [http://localhost:3000/](http://localhost:3000/) にアクセスし、ログインする。初期アカウントのユーザー名は `root`、パスワードは `123456` である。

より詳細なデプロイのチュートリアルについては、[このページ](https://iamazing.cn/page/how-to-deploy-a-website) を参照してください。

### マルチマシンデプロイ
1. すべてのサーバに同じ `SESSION_SECRET` を設定する。
2. `SQL_DSN` を設定し、SQLite の代わりに MySQL を使用する。すべてのサーバは同じデータベースに接続する。
3. マスターノード以外のノードの `NODE_TYPE` を `slave` に設定する。
4. データベースから定期的に設定を同期するサーバーには `SYNC_FREQUENCY` を設定する。
5. マスター以外のノードでは、オプションで `FRONTEND_BASE_URL` を設定して、ページ要求をマスターサーバーにリダイレクトすることができます。
6. マスター以外のノードには Redis を個別にインストールし、`REDIS_CONN_STRING` を設定して、キャッシュの有効期限が切れていないときにデータベースにゼロレイテンシーでアクセスできるようにする。
7. メインサーバーでもデータベースへのアクセスが高レイテンシになる場合は、Redis を有効にし、`SYNC_FREQUENCY` を設定してデータベースから定期的に設定を同期する必要がある。

Please refer to the [environment variables](#environment-variables) section for details on using environment variables.

### コントロールパネル（例: Baota）への展開
詳しい手順は [#175](https://github.com/songquanpeng/one-api/issues/175) を参照してください。

配置後に空白のページが表示される場合は、[#97](https://github.com/songquanpeng/one-api/issues/97) を参照してください。

### サードパーティプラットフォームへのデプロイ
<details>
<summary><strong>Sealos へのデプロイ</strong></summary>
<div>

> Sealos は、高い同時実行性、ダイナミックなスケーリング、数百万人のユーザーに対する安定した運用をサポートしています。

> 下のボタンをクリックすると、ワンクリックで展開できます。👇

[![](https://raw.githubusercontent.com/labring-actions/templates/main/Deploy-on-Sealos.svg)](https://cloud.sealos.io/?openapp=system-fastdeploy?templateName=one-api)


</div>
</details>

<details>
<summary><strong>Zeabur へのデプロイ</strong></summary>
<div>

> Zeabur のサーバーは海外にあるため、ネットワークの問題は自動的に解決されます。

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/7Q0KO3)

1. まず、コードをフォークする。
2. [Zeabur](https://zeabur.com?referralCode=songquanpeng) にアクセスしてログインし、コンソールに入る。
3. 新しいプロジェクトを作成します。Service -> Add ServiceでMarketplace を選択し、MySQL を選択する。接続パラメータ（ユーザー名、パスワード、アドレス、ポート）をメモします。
4. 接続パラメータをコピーし、```create database `one-api` ``` を実行してデータベースを作成する。
5. その後、Service -> Add Service で Git を選択し（最初の使用には認証が必要です）、フォークしたリポジトリを選択します。
6. 自動デプロイが開始されますが、一旦キャンセルしてください。Variable タブで `PORT` に `3000` を追加し、`SQL_DSN` に `<username>:<password>@tcp(<addr>:<port>)/one-api` を追加します。変更を保存する。SQL_DSN` が設定されていないと、データが永続化されず、再デプロイ後にデータが失われるので注意すること。
7. 再デプロイを選択します。
8. Domains タブで、"my-one-api" のような適切なドメイン名の接頭辞を選択する。最終的なドメイン名は "my-one-api.zeabur.app" となります。独自のドメイン名を CNAME することもできます。
9. デプロイが完了するのを待ち、生成されたドメイン名をクリックして One API にアクセスします。

</div>
</details>

## コンフィグ
システムは箱から出してすぐに使えます。

環境変数やコマンドラインパラメータを設定することで、システムを構成することができます。

システム起動後、`root` ユーザーとしてログインし、さらにシステムを設定します。

## 使用方法
`Channels` ページで API Key を追加し、`Tokens` ページでアクセストークンを追加する。

アクセストークンを使って One API にアクセスすることができる。使い方は [OpenAI API](https://platform.openai.com/docs/api-reference/introduction) と同じです。

OpenAI API が使用されている場所では、API Base に One API のデプロイアドレスを設定することを忘れないでください（例: `https://openai.justsong.cn`）。API Key は One API で生成されたトークンでなければなりません。

具体的な API Base のフォーマットは、使用しているクライアントに依存することに注意してください。

```mermaid
graph LR
    A(ユーザ)
    A --->|リクエスト| B(One API)
    B -->|中継リクエスト| C(OpenAI)
    B -->|中継リクエスト| D(Azure)
    B -->|中継リクエスト| E(その他のダウンストリームチャンネル)
```

現在のリクエストにどのチャネルを使うかを指定するには、トークンの後に チャネル ID を追加します： 例えば、`Authorization: Bearer ONE_API_KEY-CHANNEL_ID` のようにします。
チャンネル ID を指定するためには、トークンは管理者によって作成される必要があることに注意してください。

もしチャネル ID が指定されない場合、ロードバランシングによってリクエストが複数のチャネルに振り分けられます。

### 環境変数
1. `REDIS_CONN_STRING`: 設定すると、リクエストレート制限のためのストレージとして、メモリの代わりに Redis が使われる。
    + 例: `REDIS_CONN_STRING=redis://default:redispw@localhost:49153`
2. `SESSION_SECRET`: 設定すると、固定セッションキーが使用され、システムの再起動後もログインユーザーのクッキーが有効であることが保証されます。
    + 例: `SESSION_SECRET=random_string`
3. `SQL_DSN`: 設定すると、SQLite の代わりに指定したデータベースが使用されます。MySQL バージョン 8.0 を使用してください。
    + 例: `SQL_DSN=root:123456@tcp(localhost:3306)/oneapi`
4. `LOG_SQL_DSN`: を設定すると、`logs`テーブルには独立したデータベースが使用されます。MySQLまたはPostgreSQLを使用してください。
5. `FRONTEND_BASE_URL`: 設定されると、バックエンドアドレスではなく、指定されたフロントエンドアドレスが使われる。
    + 例: `FRONTEND_BASE_URL=https://openai.justsong.cn`
6. `SYNC_FREQUENCY`: 設定された場合、システムは定期的にデータベースからコンフィグを秒単位で同期する。設定されていない場合、同期は行われません。
    + 例: `SYNC_FREQUENCY=60`
7. `NODE_TYPE`: 設定すると、ノードのタイプを指定する。有効な値は `master` と `slave` である。設定されていない場合、デフォルトは `master`。
    + 例: `NODE_TYPE=slave`
8. `CHANNEL_UPDATE_FREQUENCY`: 設定すると、チャンネル残高を分単位で定期的に更新する。設定されていない場合、更新は行われません。
    + 例: `CHANNEL_UPDATE_FREQUENCY=1440`
9. `CHANNEL_TEST_FREQUENCY`: 設定すると、チャンネルを定期的にテストする。設定されていない場合、テストは行われません。
    + 例: `CHANNEL_TEST_FREQUENCY=1440`
10. `POLLING_INTERVAL`: チャネル残高の更新とチャネルの可用性をテストするときのリクエスト間の時間間隔 (秒)。デフォルトは間隔なし。
    + 例: `POLLING_INTERVAL=5`

### コマンドラインパラメータ
1. `--port <port_number>`: サーバがリッスンするポート番号を指定。デフォルトは `3000` です。
    + 例: `--port 3000`
2. `--log-dir <log_dir>`: ログディレクトリを指定。設定しない場合、ログは保存されません。
    + 例: `--log-dir ./logs`
3. `--version`: システムのバージョン番号を表示して終了する。
4. `--help`: コマンドの使用法ヘルプとパラメータの説明を表示。

## スクリーンショット
![channel](https://user-images.githubusercontent.com/39998050/233837954-ae6683aa-5c4f-429f-a949-6645a83c9490.png)
![token](https://user-images.githubusercontent.com/39998050/233837971-dab488b7-6d96-43af-b640-a168e8d1c9bf.png)

## FAQ
1. ノルマとは何か？どのように計算されますか？One API にはノルマ計算の問題はありますか？
    + ノルマ = グループ倍率 * モデル倍率 * (プロンプトトークンの数 + 完了トークンの数 * 完了倍率)
    + 完了倍率は、公式の定義と一致するように、GPT3.5 では 1.33、GPT4 では 2 に固定されています。
    + ストリームモードでない場合、公式 API は消費したトークンの総数を返す。ただし、プロンプトとコンプリートの消費倍率は異なるので注意してください。
2. アカウント残高は十分なのに、"insufficient quota" と表示されるのはなぜですか？
    + トークンのクォータが十分かどうかご確認ください。トークンクォータはアカウント残高とは別のものです。
    + トークンクォータは最大使用量を設定するためのもので、ユーザーが自由に設定できます。
3. チャンネルを使おうとすると "No available channels" と表示されます。どうすればいいですか？
    + ユーザーとチャンネルグループの設定を確認してください。
    + チャンネルモデルの設定も確認してください。
4. チャンネルテストがエラーを報告する: "invalid character '<' looking for beginning of value"
    + このエラーは、返された値が有効な JSON ではなく、HTML ページである場合に発生する。
    + ほとんどの場合、デプロイサイトのIPかプロキシのノードが CloudFlare によってブロックされています。
5. ChatGPT Next Web でエラーが発生しました: "Failed to fetch"
    + デプロイ時に `BASE_URL` を設定しないでください。
    + インターフェイスアドレスと API Key が正しいか再確認してください。

## 関連プロジェクト
* [FastGPT](https://github.com/labring/FastGPT): LLM に基づく知識質問応答システム
* [CherryStudio](https://github.com/CherryHQ/cherry-studio):  マルチプラットフォーム対応のAIクライアント。複数のサービスプロバイダーを統合管理し、ローカル知識ベースをサポートします。
## 注
本プロジェクトはオープンソースプロジェクトです。OpenAI の[利用規約](https://openai.com/policies/terms-of-use)および**適用される法令**を遵守してご利用ください。違法な目的での利用はご遠慮ください。

このプロジェクトは MIT ライセンスで公開されています。これに基づき、ページの最下部に帰属表示と本プロジェクトへのリンクを含める必要があります。

このプロジェクトを基にした派生プロジェクトについても同様です。

帰属表示を含めたくない場合は、事前に許可を得なければなりません。

MIT ライセンスによると、このプロジェクトを利用するリスクと責任は利用者が負うべきであり、このオープンソースプロジェクトの開発者は責任を負いません。
