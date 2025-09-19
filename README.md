# AIとのコンテンツ共創アプリ

## 概要

カンファレンスのブース展示用のインタラクティブなゲーム

## 機能

- **AI連携**: Vertex AI (Gemini)を使用したゲーム自動生成
- **タイマー機能**: 5分間の制限時間
- **スコアリング**: ゲーム評価とランキング機能
- **ギャラリー**: 過去のゲーム閲覧・再生機能
- **その他ページ**: ランキング、ルール説明

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
LOCATION=us-central1

# 使いたいモデル
MODEL_NAME=gemini-2.5-pro

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
3. 各参加者がプロンプトを入力してゲームを改良
4. 5分間の制限時間内でゲーム完成を目指す
5. 完成後はスコア評価とランキング登録
6. 他の参加者の作品は「ギャラリー」で閲覧・「ランキング」で確認可能

### 各ページへのアクセス
- `/` - メインゲーム画面
- `/gallery.html` - 過去ゲーム一覧
- `/ranking.html` - スコアランキング
- `/rules.html` - ルール説明

