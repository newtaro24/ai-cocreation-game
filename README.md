# AIとのコンテンツ共創アプリ

## 概要

カンファレンスのブース展示用のインタラクティブなゲーム

## 機能

- **AI連携**: Vertex AI (Gemini Pro)を使用したゲーム自動生成
- **タイマー機能**: 3分間の制限時間

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
以下サンプルです（適当に試すために、insightのlocalプロジェクト作りましたが、専用プロジェクト作って共有してもいいです）

```env
# Vertex AI設定
GOOGLE_APPLICATION_CREDENTIALS=service-account-key.json
PROJECT_ID=insight-local-001
LOCATION=asia-northeast1

# 使いたいモデル
MODEL_NAME=gemini-2.5-flash

# サーバー設定
PORT=3000
```

### 3. 起動

```bash
npm start
or 
npm run dev
```

`http://localhost:3000` にアクセス

## 遊び方
1. 参加者を追加
2. チャレンジを開始
3. 出てきたお題に対してプロンプトを入力してゲームを改善

## まだできないけどこれからやりたいこと
- 成果物やプロンプト履歴の永続化
- 成果物を自動コミットする機能
- ゲーム以外への対応（canvasとか）
- (optional) 変な成果物が出てきた時のリバート機能
