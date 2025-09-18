# AIとのコンテンツ共創アプリ

## 概要

カンファレンスのブース展示用のインタラクティブなゲーム

## 機能

- **AI連携**: Vertex AI (Gemini)を使用したゲーム自動生成
- **タイマー機能**: 5分間の制限時間
- **セッション管理**: 複数参加者対応（最大10名）
- **ゲーム履歴**: 過去のゲーム閲覧機能

and more...

## セットアップ

### 1. パッケージのインストール

```bash
npm i
```

### 2. Vertex AI の設定

#### サービスアカウントの作成

1. Google Cloud で `Vertex AI ユーザー` 権限を付与した サービスアカウントを作成して、JSONキーをダウンロード
2. service-account-key.json を作成して中身を配置


#### 環境変数の設定

`.env` を作成（gitignoreしてあります）して以下のような感じで記述
以下サンプルです

```env
# Vertex AI設定
GOOGLE_APPLICATION_CREDENTIALS=service-account-key.json
PROJECT_ID=XXXX
LOCATION=asia-northeast1

# 使いたいモデル
MODEL_NAME=gemini-2.5-flash

# サーバー設定
PORT=3000
```

### 3. 起動

```bash
# 本番起動
npm start

# 開発モード
npm run dev
```

`http://localhost:3000` にアクセス

## 遊び方
1. 参加者名をカンマ区切りで入力（例: "田中,佐藤,鈴木"）
2. セッション開始ボタンをクリック
3. 各参加者が順番にプロンプトを入力してゲームを改良
4. 5分間の制限時間内でゲーム完成を目指す
5. 完成後は「ゲーム履歴を見る」で過去作品を閲覧可能

## API エンドポイント
```
POST /api/sessions          # セッション作成
GET  /api/sessions          # 全セッション取得
POST /api/generate-game     # AIゲーム生成
GET  /api/games/all         # 全ゲーム取得（ギャラリー用）
GET  /api/stats/health      # ヘルスチェック
```

## プロジェクト構造
```
src/
├── app.js                  # メインサーバー
├── services/               # ビジネスロジック
├── routes/                 # API routes
└── config/                 # 設定ファイル
data/                       # データ保存先（gitignore済み）
```
