# 概要

就活インターン管理アプリ。企業情報・締切・イベントをカレンダーとリストで一元管理できます。

## 機能

- カレンダービューで締切・インターン期間を可視化
- 企業ごとに複数の選考（インターン・早期選考・本選考など）を管理
- 選考ごとに自由な選考ステップ、現在地、結果を管理
- 企業ごとにメモ・アカウント情報・ファイルを管理
- 締切カウントダウン・日程重複警告
- 企業フィルタ（表示/非表示）
- マイページURL・ログインID管理（コピーボタン付き）
- 各企業フォルダ内のファイルを直接開く
- 業界カテゴリの追加・管理

## セットアップ

### 1. 依存パッケージをインストール

```bash
cd recruit-portal
npm install
```

### 2. データファイルを用意

```bash
cp -r src/data.example src/data
```

### 3. 環境変数を設定

```bash
cp .env.local.example .env.local
```

#### RECRUIT_ROOT（オプション）

企業ごとのREADMEファイルをアプリと別ディレクトリで管理したい場合は `RECRUIT_ROOT` を指定します。

```
RECRUIT_ROOT=/Users/yourname/Documents/recruit
```

設定しない場合は `recruit-portal/` の親ディレクトリがデフォルトになります。

#### RECRUIT_SECRET_KEY（必須・パスワード暗号化用）

`companies.json` に保存される企業マイページパスワードを AES-256-GCM で暗号化するための鍵。

```bash
npm run gen-key
```

出力された `RECRUIT_SECRET_KEY=...` の行を `.env.local` に貼り付けます。**この値は絶対に Git に commit しないこと**。

既に平文パスワードを登録済の場合は、鍵設定後に下記で一括暗号化できます:

```bash
npm run encrypt-existing
```

新規追加・編集時は自動で暗号化されます。

### 4.ビルド
```bash
npm run build
```

### 5. 起動

```bash
npm run start
```
※ Windowsの場合 Start_NextServer_rp.bat をスタートメニューから実行することでも起動できます

`http://localhost:3000` にアクセスします。

サーバーは安全のため `127.0.0.1` のみに待ち受けます。LAN内のIPアドレスや
Tailscale IPへ直接アクセスすることはできません。

### 6. Tailscaleからアクセスする場合

Next.jsを起動した状態で、ホスト側でTailscale Serveを設定します。

```bash
tailscale serve --bg http://127.0.0.1:3000
tailscale serve status
```

`tailscale serve` が表示した `https://...ts.net` のURLへ、同じtailnet内の端末から
アクセスします。インターネット全体へ公開するTailscale Funnelは使用しないでください。

停止・設定解除:

```bash
tailscale serve reset
```

Tailscaleを複数人で共有している場合は、ACL/grantsでこの端末へのアクセスを自分の
ユーザーまたは端末だけに制限してください。

## 旧ステータスからの移行

旧データ（イベントの `status` を使用しているデータ）を新しい選考モデルへ移行する場合、
最初にドライランで件数を確認します。

```bash
npm run migrate-status-model
```

問題がなければ、バックアップを作成して移行します。

```bash
npm run migrate-status-model -- --apply
```

移行後は、企業詳細の「選考プロセス」で `既存選考（要確認）` の名称・種類・現在の
ステップを確認してください。移行済みデータに対して再実行しても変更は行われません。

## ステータス設計

- **企業の追跡状態**: 追跡中・保留・アーカイブ
- **選考プロセス**: 検討中・進行中・完了・終了と、参加確定・内定・不合格・辞退の結果
- **選考ステップ**: 未着手・対応必要・予定あり・提出済み・結果待ち・完了・スキップ・中止
- **カレンダー予定**: 要対応・予定・完了・中止

「今すること」と「選考結果」を別々に保持するため、インターン合格後も一律に
「選考中」と表示される不整合を防ぎます。

## セキュリティ上の制約

- `/api/open` で取得できるのは、登録済み企業フォルダ直下の通常ファイルだけです
- `.env.local`、アプリのソース、隠しファイル、シンボリックリンクは取得できません
- HTML・SVGは同一オリジンでのスクリプト実行を防ぐためダウンロード扱いになります
- 企業ID・カテゴリIDは英数字、`_`、`-` のみに制限されます
- `RECRUIT_ROOT` 外へ解決されるパスは、読み書き・削除のいずれも拒否されます

## ディレクトリ構成

```
recruit-portal/
├── src/
│   ├── app/           # ページ
│   ├── components/    # UIコンポーネント
│   ├── data/          # データファイル（gitignore対象）
│   ├── data.example/  # サンプルデータ
│   └── lib/           # データ読み書きロジック
└── .env.local.example
```

## 技術スタック

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- FullCalendar
