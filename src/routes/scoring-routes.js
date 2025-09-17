const express = require('express');
const ScoringService = require('../services/scoring-service');
const FileService = require('../services/file-service');
const router = express.Router();

const scoringService = new ScoringService();
const fileService = FileService; // 既にインスタンス化されたオブジェクト

/**
 * ゲームスコアリング実行
 * POST /api/games/:gameId/score
 */
router.post('/games/:gameId/score', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { theme, promptHistory } = req.body;

        console.log(`Scoring request for game: ${gameId}`);

        // ゲームファイルから情報取得
        const gameInfo = await fileService.getGameInfo(gameId);
        if (!gameInfo) {
            return res.status(404).json({
                success: false,
                error: 'Game not found'
            });
        }

        // 既にスコアリング済みかチェック
        const existingScore = await scoringService.getScore(gameId);
        if (existingScore) {
            return res.json({
                success: true,
                score: existingScore,
                message: 'Score already exists'
            });
        }

        // スコアリングデータ準備
        const gameData = {
            gameId,
            participant: gameInfo.participant,
            theme,
            htmlContent: gameInfo.htmlContent,
            promptHistory,
            createdAt: gameInfo.createdAt
        };

        // AIスコアリング実行
        const scoreResult = await scoringService.scoreGame(gameData);

        res.json({
            success: true,
            score: scoreResult
        });

    } catch (error) {
        console.error('Scoring API error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'スコアリング中にエラーが発生しました'
        });
    }
});

/**
 * 個別スコア取得
 * GET /api/games/:gameId/score
 */
router.get('/games/:gameId/score', async (req, res) => {
    try {
        const { gameId } = req.params;
        const score = await scoringService.getScore(gameId);

        if (!score) {
            return res.status(404).json({
                success: false,
                error: 'Score not found'
            });
        }

        res.json({
            success: true,
            score
        });

    } catch (error) {
        console.error('Get score API error:', error);
        res.status(500).json({
            success: false,
            error: 'スコア取得中にエラーが発生しました'
        });
    }
});

/**
 * ランキング取得
 * GET /api/rankings?limit=50
 */
router.get('/rankings', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const rankings = await scoringService.getRankings(limit);

        res.json({
            success: true,
            rankings
        });

    } catch (error) {
        console.error('Rankings API error:', error);
        res.status(500).json({
            success: false,
            error: 'ランキング取得中にエラーが発生しました'
        });
    }
});

/**
 * 全スコア統計取得
 * GET /api/scores/stats
 */
router.get('/scores/stats', async (req, res) => {
    try {
        const allScores = await scoringService.getAllScores();

        if (allScores.length === 0) {
            return res.json({
                success: true,
                stats: {
                    totalGames: 0,
                    averageScore: 0,
                    highestScore: 0,
                    lowestScore: 0
                }
            });
        }

        const scores = allScores.map(s => s.totalScore);
        const stats = {
            totalGames: allScores.length,
            averageScore: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
            highestScore: Math.max(...scores),
            lowestScore: Math.min(...scores)
        };

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('Score stats API error:', error);
        res.status(500).json({
            success: false,
            error: '統計取得中にエラーが発生しました'
        });
    }
});

module.exports = router;