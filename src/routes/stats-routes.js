const express = require('express');
const router = express.Router();
const sessionService = require('../services/session-service');
const { AI_CONFIG } = require('../config/ai-config');

// 統計情報取得
router.get('/', (req, res) => {
    try {
        const stats = sessionService.getStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: '統計の取得に失敗しました' });
    }
});

// ヘルスチェック
router.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        aiProvider: 'vertex-ai',
        projectId: AI_CONFIG.projectId || 'not configured',
        location: AI_CONFIG.location,
        model: AI_CONFIG.modelName,
        configured: !!(AI_CONFIG.projectId && process.env.GOOGLE_APPLICATION_CREDENTIALS),
        timestamp: new Date().toISOString()
    });
});

// システム情報取得
router.get('/system', (req, res) => {
    const systemInfo = {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        env: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    };
    
    res.json({ success: true, system: systemInfo });
});

module.exports = router;