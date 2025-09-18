# AI Co-creation Game - Project Memory

## 🎯 プロジェクト概要

**AI共創ゲーム開発アプリケーション** - カンファレンスブース展示用のリアルタイム協創体験

### 基本コンセプト
- 複数参加者が順番にプロンプトを入力
- Google Vertex AI (Gemini 2.5 Flash) がゲームを生成・改良
- 5分間の制限時間内でミニゲームを完成させる
- リアルタイムで結果を表示し、過去のゲーム履歴も閲覧可能

## 🏗️ アーキテクチャ

### 技術スタック
- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/CSS/JavaScript (シングルページ)
- **AI**: Google Cloud Vertex AI (Gemini 2.5 Flash)
- **Data**: ファイルベースストレージ (タイムスタンプフォルダ構造)

### ファイル構造
```
├── src/                     # リファクタリング後のモジュール化構造
│   ├── app.js              # メインサーバー
│   ├── config/
│   │   └── ai-config.js    # AI設定
│   ├── services/
│   │   ├── ai-service.js   # AI生成処理
│   │   ├── session-service.js # セッション管理
│   │   └── file-service.js # ファイル管理
│   ├── routes/
│   │   ├── game-routes.js  # ゲーム関連API
│   │   ├── session-routes.js # セッション関連API
│   │   └── stats-routes.js # 統計関連API
│   └── utils/
│       └── validators.js   # バリデーション
├── index.html              # フロントエンド
├── script.js               # フロントエンドロジック (757行)
├── styles.css              # スタイリング
└── data/                   # 永続化データ (gitignore済み)
    └── sessions/
        └── session_TIMESTAMP_ID/
            ├── session.json
            ├── participants.json
            └── game_XXX_participant.html
```

## 🚀 起動コマンド

```bash
# 新しいリファクタリング版
npm start

# レガシー版（必要時）
npm run start:legacy

# 開発モード
npm run dev
```

## 📡 API エンドポイント

### セッション管理
- `POST /api/sessions` - セッション作成
- `GET /api/sessions` - 全セッション取得
- `GET /api/sessions/:id` - 個別セッション取得
- `PUT /api/sessions/:id` - セッション更新
- `DELETE /api/sessions/:id` - セッション削除

### ゲーム関連
- `POST /api/generate-game` - AIゲーム生成
- `POST /api/sessions/:id/games` - ゲームファイル保存
- `GET /api/games/all` - 全ゲーム取得（ギャラリー用）

### 統計・監視
- `GET /api/stats` - 統計情報
- `GET /api/stats/health` - ヘルスチェック
- `GET /api/stats/system` - システム情報

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
5. **履歴閲覧**: 過去ゲームのギャラリー機能

## 🛠️ 最近の改善履歴

### 2025-09-13 大規模リファクタリング
- 単一ファイル(682行)から機能別モジュール化
- サービス層分離によるSoC実現
- 永続化層のGitignore対応
- バリデーション強化
- エラーハンドリング改善
- レガシーAPI互換性維持

### 主要課題解決
- ✅ AI生成エラーの安定化
- ✅ データ永続化の実装
- ✅ 参加者UX向上（統合フロー）
- ✅ セッション管理の完全自動化
- ✅ ギャラリー機能追加

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

## 🎯 今後の拡張候補

- [ ] WebSocket実装（リアルタイム同期）
- [ ] 参加者ランキング機能
- [ ] ゲーム評価システム
- [ ] マルチテーマ対応
- [ ] モバイル最適化

---

**Last Updated**: 2025-09-13
**Status**: ✅ Production Ready
**Version**: 2.0 (Refactored)