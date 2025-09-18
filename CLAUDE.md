# AI Co-creation Game - Project Memory

## 🎯 プロジェクト概要

**AI共創ゲーム開発アプリケーション** - カンファレンスブース展示用のリアルタイム協創体験

### 基本コンセプト
- 複数参加者が順番にプロンプトを入力
- Google Vertex AI がゲームを生成・改良
- 5分間の制限時間内でミニゲームを完成させる
- リアルタイムで結果を表示し、過去のゲーム履歴も閲覧可能
- スコアリング機能とランキング表示
- ルール説明とギャラリー機能

## 🏗️ アーキテクチャ

### 技術スタック
- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/CSS/JavaScript (シングルページ)
- **AI**: Google Cloud Vertex AI
- **Data**: ファイルベースストレージ (タイムスタンプフォルダ構造)

### ファイル構造
```
├── src/                     # リファクタリング後のモジュール化構造
│   ├── app.js              # メインサーバー
│   ├── config/
│   │   └── ai-config.js    # AI設定
│   ├── services/
│   │   ├── ai-service.js   # AI生成処理
│   │   ├── file-service.js # ファイル管理
│   │   └── scoring-service.js # スコアリング
│   ├── routes/
│   │   ├── game-routes.js  # ゲーム関連API
│   │   ├── scoring-routes.js # スコアリングAPI
│   │   └── stats-routes.js # 統計関連API
│   └── utils/
│       └── validators.js   # バリデーション
├── index.html              # メインページ
├── gallery.html            # ギャラリーページ
├── ranking.html            # ランキングページ
├── rules.html              # ルール説明ページ
├── script.js               # フロントエンドロジック
├── styles.css              # スタイリング
└── data/                   # 永続化データ (gitignore済み)
    ├── games/              # ゲームHTML保存
    │   └── game_TIMESTAMP_PARTICIPANT.html  # セッション情報付き
    ├── scores/             # スコアデータ
    │   ├── score_game_TIMESTAMP_PARTICIPANT.json
    │   └── rankings.json
    └── sessions/           # セッション管理（NEW）
        └── session_SESSIONID/
            ├── session.json      # セッション情報
            ├── prompt_history.json # プロンプト履歴
            └── final_game.html   # 最終成果物
```

## 🚀 起動コマンド

```bash
# 本番
npm start

# 開発モード
npm run dev
```

## 📡 API エンドポイント

### セッション管理（NEW）
- `POST /api/sessions/create` - セッション作成
- `GET /api/sessions/:sessionId` - セッション情報取得
- `GET /api/sessions` - 全セッション一覧
- `POST /api/sessions/:sessionId/prompts` - プロンプト追加
- `GET /api/sessions/:sessionId/prompts` - プロンプト履歴取得
- `POST /api/sessions/:sessionId/complete` - セッション完了

### ゲーム関連
- `POST /api/games/generate` - AIゲーム生成
- `POST /api/games/:sessionId/save` - ゲームファイル保存
- `GET /api/games/all` - 全ゲーム取得（ギャラリー用）
- `GET /api/games/:sessionId/:fileName` - 個別ゲーム取得
- `DELETE /api/games/:sessionId/:fileName` - ゲーム削除

### スコアリング
- `POST /api/scoring/games/:gameId/score` - ゲームスコア投稿
- `GET /api/scoring/games/:gameId/score` - ゲームスコア取得
- `GET /api/scoring/rankings` - ランキング取得
- `GET /api/scoring/scores/stats` - スコア統計

### 統計・監視
- `GET /api/stats` - 統計情報
- `GET /api/stats/health` - ヘルスチェック
- `GET /api/stats/system` - システム情報

### レガシー（互換性維持）
- `POST /api/generate-game` - AIゲーム生成（旧API）
- `POST /api/games/save` - ゲーム保存（旧API、セッション情報対応済み）

## 🔧 設定要件

### 環境変数 (.env)
```env
PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=service-account-key.json
LOCATION=asia-northeast1
MODEL_NAME=gemini-2.5-flash
PORT=3000
```

### Google Cloud設定
- Vertex AI API有効化
- サービスアカウント作成（`Vertex AI ユーザー` 権限必要）
- `service-account-key.json` をプロジェクトルートに配置

## 🎮 ユーザーフロー

1. **セッション開始**: 参加者登録（カンマ区切り、最大10名）
2. **ゲーム制作**: 順番にプロンプト入力→AI生成→改良
3. **制限時間**: 5分カウントダウン
4. **完成発表**: 最終ゲーム表示
5. **評価・共有**: スコア投稿とランキング登録
6. **履歴閲覧**: ギャラリーでの過去作品一覧とランキング確認

### ページ構成
- **index.html**: メインゲーム画面（プロンプト入力・AI生成）
- **gallery.html**: 過去ゲーム一覧表示
- **ranking.html**: スコアランキング表示
- **rules.html**: ゲームルール説明

## 💡 運用ノート

### デプロイメント
- ローカル実行専用設計
- `data/` フォルダは自動生成
- 静的ファイルはプロジェクトルートから配信

### パフォーマンス
- Vertex AI: token limit 8192
- セッション同時実行: 制限なし
- ファイルストレージ: 軽量HTML保存

### セキュリティ
- CORS: ローカル開発用に緩和
- 入力検証: 専用validator実装
- API認証: なし（展示ブース用）
