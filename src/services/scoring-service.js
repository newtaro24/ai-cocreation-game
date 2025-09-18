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

        return `あなたはプロンプト評価の専門家です。以下のゲーム作成チャレンジを、「プロンプトでいかに要求を満たせたか」の観点で評価してください。

【お題】
タイトル: ${themeInfo.title}
説明: ${themeInfo.description}
機能要件: ${themeInfo.requirements.join(', ')}

【参加者のプロンプト履歴】
${historyText}

【AIが生成したゲーム】
${htmlContent}

【評価観点】（総合1000点満点）
このチャレンジは「プロンプト力」を競うゲームです。参加者がどれだけ上手にAIに指示を出せたかを評価してください：

1. 機能要件達成度（200点）：お題の要求をプロンプトで正確に伝えられたか
2. ゲーム完成度（200点）：完成したゲームとして成立しているか
3. UI/UX品質（200点）：見た目や操作性の良さ
4. プレイアビリティ（200点）：実際に遊んで面白いか
5. 創造性（200点）：独自のアイデアや工夫があるか

【採点基準】
- 平均400-550点、優秀650-750点の厳格評価
- 各項目で1点刻みの細かい差をつける
- プロンプトが短くても要求を満たせば高評価
- プロンプトが長くても結果が悪ければ低評価

以下のJSON形式で回答してください：
{
  "detailScores": {
    "requiredFeatures": [0-200点の範囲で評価],
    "completeness": [0-200点の範囲で評価],
    "uiUx": [0-200点の範囲で評価],
    "playability": [0-200点の範囲で評価],
    "creativity": [0-200点の範囲で評価]
  },
  "comment": "具体的なゲーム機能と実装品質について評価し、プロンプトの効果について言及"
}

【コメント作成指針】：
- 具体的なゲーム機能と実装状況を確認
- プロンプトの工夫とその効果を適度に評価
- 技術的詳細より、実際のプレイ体験に焦点
- 2-3文で簡潔にまとめる
- 口調をちょっとカジュアルで辛口な感じにしてください

【重要な採点注意事項】：
- 必ずJSONのみ出力（他のテキスト一切不要）
- 各項目のスコアは必ず異なる値にする（同じ値は絶対禁止）
- ゲームの品質に応じて1点刻みで細かく差をつける
- サンプル例と同じ値は使用しない（オリジナルの評価をする）
- 平均400-550点、優秀650-750点の厳格な基準で評価
- プロンプト力を重視した評価とコメントを作成`;
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