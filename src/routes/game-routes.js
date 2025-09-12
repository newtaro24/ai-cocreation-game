const express = require('express');
const router = express.Router();
const aiService = require('../services/ai-service');
const fileService = require('../services/file-service');
const { validatePrompt } = require('../utils/validators');

// ゲーム生成エンドポイント
router.post('/generate', async (req, res) => {
    try {
        const { prompt, previousPrompts, theme } = req.body;
        
        // プロンプトの検証
        const validation = validatePrompt(prompt);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.message });
        }
        
        console.log(`Generating game for prompt: ${prompt}`);
        console.log(`Theme: ${theme || 'none'}`);
        console.log(`Previous prompts: ${previousPrompts?.length || 0}`);
        
        let htmlGame;
        
        if (!aiService.isConfigured()) {
            console.warn('Vertex AI not configured');
            htmlGame = aiService.createErrorGame('Vertex AIが設定されていません');
        } else {
            try {
                htmlGame = await aiService.generateGame(validation.sanitized, previousPrompts, theme);
                console.log(`Generated HTML length: ${htmlGame.length}`);
            } catch (error) {
                console.error('Vertex AI error:', error);
                htmlGame = aiService.createErrorGame('AI生成エラーが発生しました');
            }
        }
        
        res.json({ 
            success: true, 
            html: htmlGame,
            provider: 'vertex-ai'
        });
        
    } catch (error) {
        console.error('Error generating game:', error);
        res.status(500).json({ 
            error: 'ゲーム生成中にエラーが発生しました',
            details: error.message 
        });
    }
});

// セッション内ゲーム保存エンドポイント (新API)
router.post('/:sessionId/save', (req, res) => {
    try {
        const { sessionId } = req.params;
        const { html, prompt, participant, gameIndex } = req.body;
        
        const result = fileService.saveGameFile(sessionId, {
            html,
            prompt,
            participant,
            gameIndex
        });
        
        console.log(`Game saved: ${result.fileName} in session ${sessionId}`);
        
        res.json({ 
            success: true, 
            fileName: result.fileName,
            filePath: result.filePath
        });
        
    } catch (error) {
        console.error('Error saving game file:', error);
        res.status(500).json({ error: 'ゲームファイルの保存に失敗しました' });
    }
});

// 全ゲーム取得エンドポイント（ギャラリー用）
router.get('/all', (req, res) => {
    try {
        const allGames = fileService.getAllGames();
        res.json({ success: true, games: allGames });
    } catch (error) {
        console.error('Error getting game files:', error);
        res.status(500).json({ error: 'ゲームファイルの取得に失敗しました' });
    }
});

// 個別ゲームファイル取得
router.get('/:sessionId/:fileName', (req, res) => {
    try {
        const { sessionId, fileName } = req.params;
        
        const content = fileService.getGameFile(sessionId, fileName);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(content);
    } catch (error) {
        console.error('Error getting game file:', error);
        res.status(404).json({ error: 'ゲームファイルが見つかりません' });
    }
});

// ゲームファイル削除
router.delete('/:sessionId/:fileName', (req, res) => {
    try {
        const { sessionId, fileName } = req.params;
        
        fileService.deleteGameFile(sessionId, fileName);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting game file:', error);
        res.status(500).json({ error: 'ゲームファイルの削除に失敗しました' });
    }
});

module.exports = router;