const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs').promises;
const path = require('path');

class ScoringService {
    constructor() {
        this.projectId = process.env.PROJECT_ID;
        this.location = process.env.LOCATION || 'us-central1';
        this.modelName = process.env.MODEL_NAME || 'gemini-2.5-pro';

        this.vertexAI = new VertexAI({
            project: this.projectId,
            location: this.location
        });

        this.scoresDir = path.join(process.cwd(), 'data', 'scores');
        this.ensureScoresDirectory();
    }

    async ensureScoresDirectory() {
        try {
            await fs.access(this.scoresDir);
        } catch (error) {
            await fs.mkdir(this.scoresDir, { recursive: true });
        }
    }

    /**
     * ゲームをAIで採点
     */
    async scoreGame(gameData) {
        const { gameId, participant, theme, htmlContent, promptHistory, createdAt } = gameData;

        try {
            console.log(`Starting AI scoring for game: ${gameId}`);

            // AIによるスコアリング
            const aiResult = await this.callScoringAI(theme, htmlContent, promptHistory);

            // スコアデータ作成
            const scoreData = {
                gameId,
                participant,
                theme: theme.title,
                themeRequirements: theme.requirements,
                htmlContent,
                promptHistory,
                totalScore: aiResult.totalScore,
                detailScores: aiResult.detailScores,
                comment: aiResult.comment,
                createdAt,
                scoredAt: new Date().toISOString(),
                promptCount: promptHistory.length
            };

            // スコア保存
            await this.saveScore(scoreData);

            console.log(`Scoring completed for ${gameId}: ${aiResult.totalScore}/100`);
            return scoreData;

        } catch (error) {
            console.error('Scoring error:', error);
            throw new Error('スコアリング中にエラーが発生しました');
        }
    }

    /**
     * AIスコアリング実行
     */
    async callScoringAI(theme, htmlContent, promptHistory) {
        const model = this.vertexAI.preview.getGenerativeModel({ model: this.modelName });

        const prompt = this.buildScoringPrompt(theme, htmlContent, promptHistory);

        const response = await model.generateContent(prompt);
        const responseText = response.response.candidates[0].content.parts[0].text;

        // JSON抽出
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('AI response format error');
        }

        const result = JSON.parse(jsonMatch[0]);

        // バリデーション
        if (!result.detailScores) {
            throw new Error('Invalid AI scoring result: detailScores missing');
        }

        // totalScoreが存在しない場合は計算して追加
        if (typeof result.totalScore !== 'number') {
            result.totalScore = Object.values(result.detailScores).reduce((sum, score) => sum + score, 0);
        }

        return result;
    }

    /**
     * スコアリング用プロンプト生成
     */
    buildScoringPrompt(theme, htmlContent, promptHistory) {
        // テーマが文字列の場合の処理
        const themeInfo = typeof theme === 'string' ? {
            title: theme,
            description: `${theme}に関連するWebゲーム`,
            requirements: ['ゲームとして機能する', '適切なUI表示', 'ユーザー操作可能']
        } : theme || {
            title: 'ミニゲーム',
            description: '5秒で遊べるミニゲーム',
            requirements: ['ゲームとして機能する', '適切なUI表示', 'ユーザー操作可能']
        };

        // プロンプト履歴の処理（文字列配列にも対応）
        const historyText = Array.isArray(promptHistory)
            ? promptHistory.map((p, i) => {
                const prompt = typeof p === 'string' ? p : p.prompt;
                return `${i + 1}. ${prompt}`;
            }).join('\n')
            : `1. ${promptHistory || '初回プロンプト'}`;

        return `あなたは厳格で細かいゲーム評価の専門家です。以下のWebゲームを厳しく、かつ細かく採点してください。

【お題】
タイトル: ${themeInfo.title}
説明: ${themeInfo.description}
機能要件: ${themeInfo.requirements.join(', ')}

【プロンプト履歴】
${historyText}

【生成されたHTML】
${htmlContent}

【厳格な評価基準】（総合1000点満点）
★ 機能要件重視の採点方針：
- 機能要件実装度：200点（20%）← 最重要
- ゲーム完成度：200点（20%）
- UI/UX品質：200点（20%）
- プレイアビリティ：200点（20%）
- 創造性：200点（20%）

★ 厳しい採点基準：
- 平均的なゲームは400-550点程度
- 優秀なゲームでも650-750点程度
- 800点以上は極めて稀な傑作のみ
- 1点単位で細かく差をつける

【詳細評価項目】
1. 機能要件実装度（0-200点）
   - 120-140点：基本機能のみ実装
   - 141-160点：要求機能をほぼ実装
   - 161-180点：要求機能を完全実装
   - 181-200点：要求を上回る実装（稀）

2. ゲーム完成度（0-200点）
   - 100-120点：動作するが不完全
   - 121-140点：基本動作OK、軽微な問題
   - 141-160点：安定動作、品質良好
   - 161-180点：高品質、バグなし
   - 181-200点：プロレベルの完成度（稀）

3. UI/UX品質（0-200点）
   - 90-110点：最低限のデザイン
   - 111-130点：普通のデザイン
   - 131-150点：良いデザイン
   - 151-170点：優秀なデザイン
   - 171-200点：卓越したデザイン（稀）

4. プレイアビリティ（0-200点）
   - 80-100点：面白さに欠ける
   - 101-120点：そこそこ楽しめる
   - 121-140点：十分面白い
   - 141-160点：非常に面白い
   - 161-200点：中毒性のある面白さ（稀）

5. 創造性（0-200点）
   - 70-90点：ありきたり
   - 91-110点：少しの工夫あり
   - 111-130点：独創的要素あり
   - 131-150点：非常に独創的
   - 151-200点：革新的アイデア（稀）

【重要な採点ガイドライン】
- 機能要件実装度を最重要視（200点満点）
- 各項目で必ず細かい差をつけること
- 同じスコアは絶対に避ける
- 機能要件が不十分なら他が良くても低評価
- プロンプト工夫度も詳細に評価する

以下のJSON形式で回答してください：
{
  "detailScores": {
    "requiredFeatures": [0-200点の範囲で評価],
    "completeness": [0-200点の範囲で評価],
    "uiUx": [0-200点の範囲で評価],
    "playability": [0-200点の範囲で評価],
    "creativity": [0-200点の範囲で評価]
  },
  "comment": "[詳細な評価理由とコメント]"
}

★ 機能要件評価の重要ポイント：
- お題で要求された具体的機能が実装されているか
- 「ゲームとして成立」しているか
- プロンプトの工夫でどこまで要求を満たしたか
- 単なる見た目ではなく「機能」重視で評価

【重要な採点注意事項】：
- 必ずJSONのみ出力（他のテキスト一切不要）
- 各項目のスコアは必ず異なる値にする（同じ値は絶対禁止）
- ゲームの品質に応じて1点刻みで細かく差をつける
- サンプル例と同じ値は使用しない（オリジナルの評価をする）
- 平均400-550点、優秀650-750点の厳格な基準で評価`;
    }

    /**
     * スコア保存
     */
    async saveScore(scoreData) {
        const fileName = `score_${scoreData.gameId.replace('.html', '')}.json`;
        const filePath = path.join(this.scoresDir, fileName);

        await fs.writeFile(filePath, JSON.stringify(scoreData, null, 2), 'utf8');

        // 全体ランキングファイルの更新
        await this.updateRankings();
    }

    /**
     * 個別スコア取得
     */
    async getScore(gameId) {
        const fileName = `score_${gameId.replace('.html', '')}.json`;
        const filePath = path.join(this.scoresDir, fileName);

        try {
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    /**
     * 全スコア取得
     */
    async getAllScores() {
        try {
            const files = await fs.readdir(this.scoresDir);
            const scoreFiles = files.filter(file => file.startsWith('score_') && file.endsWith('.json'));

            const scores = [];
            for (const file of scoreFiles) {
                try {
                    const filePath = path.join(this.scoresDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const scoreData = JSON.parse(content);
                    scores.push(scoreData);
                } catch (error) {
                    console.error(`Error reading score file ${file}:`, error);
                }
            }

            return scores;
        } catch (error) {
            return [];
        }
    }

    /**
     * ランキング更新
     */
    async updateRankings() {
        const allScores = await this.getAllScores();

        // スコア順でソート
        const rankings = allScores
            .sort((a, b) => b.totalScore - a.totalScore)
            .map((score, index) => ({
                rank: index + 1,
                gameId: score.gameId,
                participant: score.participant,
                theme: score.theme,
                totalScore: score.totalScore,
                createdAt: score.createdAt,
                scoredAt: score.scoredAt
            }));

        const rankingsPath = path.join(this.scoresDir, 'rankings.json');
        await fs.writeFile(rankingsPath, JSON.stringify({
            lastUpdated: new Date().toISOString(),
            rankings
        }, null, 2), 'utf8');

        return rankings;
    }

    /**
     * ランキング取得
     */
    async getRankings(limit = 50) {
        const rankingsPath = path.join(this.scoresDir, 'rankings.json');

        try {
            const content = await fs.readFile(rankingsPath, 'utf8');
            const data = JSON.parse(content);
            return data.rankings.slice(0, limit);
        } catch (error) {
            // ランキングファイルが存在しない場合は作成
            await this.updateRankings();
            return this.getRankings(limit);
        }
    }
}

module.exports = ScoringService;