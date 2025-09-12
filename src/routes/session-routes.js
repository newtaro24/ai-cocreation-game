const express = require('express');
const router = express.Router();
const sessionService = require('../services/session-service');
const { validateSessionName, validateTheme, validateSessionId } = require('../utils/validators');

// セッション作成
router.post('/', (req, res) => {
    try {
        const { sessionName, theme } = req.body;
        
        // 入力の検証
        const nameValidation = validateSessionName(sessionName);
        const themeValidation = validateTheme(theme);
        
        if (!nameValidation.valid) {
            return res.status(400).json({ error: nameValidation.message });
        }
        
        if (!themeValidation.valid) {
            return res.status(400).json({ error: themeValidation.message });
        }
        
        const sessionData = sessionService.createSession(
            nameValidation.sanitized,
            themeValidation.sanitized
        );
        
        console.log(`New session created: ${sessionData.id}`);
        res.json({ success: true, session: sessionData });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'セッションの作成に失敗しました' });
    }
});

// 全セッション取得
router.get('/', (req, res) => {
    try {
        const sessions = sessionService.getAllSessions();
        res.json({ success: true, sessions });
    } catch (error) {
        console.error('Error loading sessions:', error);
        res.status(500).json({ error: 'セッションの取得に失敗しました' });
    }
});

// 個別セッション取得
router.get('/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        
        // セッションIDの検証
        const validation = validateSessionId(sessionId);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.message });
        }
        
        const session = sessionService.getSession(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'セッションが見つかりません' });
        }
        
        res.json({
            success: true,
            session: session
        });
    } catch (error) {
        console.error('Error loading session:', error);
        res.status(500).json({ error: 'セッションの取得に失敗しました' });
    }
});

// セッション更新
router.put('/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const updateData = req.body;
        
        // セッションIDの検証
        const validation = validateSessionId(sessionId);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.message });
        }
        
        const updatedSession = sessionService.updateSession(sessionId, updateData);
        
        res.json({ success: true, session: updatedSession });
    } catch (error) {
        console.error('Error updating session:', error);
        
        if (error.message === 'セッションが見つかりません') {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'セッションの更新に失敗しました' });
        }
    }
});

// セッション削除
router.delete('/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        
        // セッションIDの検証
        const validation = validateSessionId(sessionId);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.message });
        }
        
        sessionService.deleteSession(sessionId);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting session:', error);
        
        if (error.message === 'セッションが見つかりません') {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'セッションの削除に失敗しました' });
        }
    }
});

module.exports = router;