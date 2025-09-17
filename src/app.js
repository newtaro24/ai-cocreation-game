const express = require('express');
const cors = require('cors');
const path = require('path');

// Services
const aiService = require('./services/ai-service');

// Routes
const gameRoutes = require('./routes/game-routes');
const statsRoutes = require('./routes/stats-routes');
const scoringRoutes = require('./routes/scoring-routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Static files - serve from parent directory
app.use(express.static(path.join(__dirname, '..')));
app.use('/data/games', express.static(path.join(__dirname, '../data', 'games')));

// API Routes
app.use('/api/games', gameRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api', statsRoutes); // For health endpoint
app.use('/api', scoringRoutes); // For scoring and rankings

// ゲーム保存エンドポイント
app.post('/api/games/save', (req, res) => {
    const { html, prompt, participant } = req.body;

    const fileService = require('./services/file-service');

    try {
        const result = fileService.saveGameFile({
            html, prompt, participant
        });

        console.log(`Game saved: ${result.fileName}`);

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

// Legacy API compatibility  
app.post('/api/generate-game', (req, res, next) => {
    req.url = '/generate';
    req.path = '/generate';
    gameRoutes(req, res, next);
});

// Initialize services
async function initializeApp() {
    try {
        await aiService.initialize();
        console.log('✅ All services initialized successfully');
    } catch (error) {
        console.warn('⚠️ Some services failed to initialize:', error.message);
    }
}

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📁 Serving static files from: ${path.join(__dirname, '..')}`);
    
    await initializeApp();
    
    console.log('🎮 AI Co-creation Game Server Ready!');
    console.log('📊 API Endpoints:');
    console.log('   - POST   /api/generate-game');
    console.log('   - POST   /api/games/save');
    console.log('   - GET    /api/games/all');
    console.log('   - POST   /api/games/:gameId/score');
    console.log('   - GET    /api/games/:gameId/score');
    console.log('   - GET    /api/rankings');
    console.log('   - GET    /api/scores/stats');
    console.log('   - GET    /api/stats');
    console.log('   - GET    /api/stats/health');
});

module.exports = app;