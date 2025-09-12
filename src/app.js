const express = require('express');
const cors = require('cors');
const path = require('path');

// Services
const aiService = require('./services/ai-service');

// Routes
const gameRoutes = require('./routes/game-routes');
const sessionRoutes = require('./routes/session-routes');
const statsRoutes = require('./routes/stats-routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Static files - serve from parent directory
app.use(express.static(path.join(__dirname, '..')));
app.use('/data/sessions', express.static(path.join(__dirname, '../data', 'sessions')));

// API Routes
app.use('/api/sessions', sessionRoutes);

// セッション内ゲーム関連のルート
app.post('/api/sessions/:sessionId/games', (req, res) => {
    // リクエストパラメータを調整
    req.url = `/${req.params.sessionId}/save`;
    req.path = `/${req.params.sessionId}/save`;
    gameRoutes(req, res);
});

app.use('/api/games', gameRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api', statsRoutes); // For health endpoint

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
    console.log('   - GET    /api/sessions');
    console.log('   - POST   /api/sessions');
    console.log('   - GET    /api/sessions/:id');
    console.log('   - PUT    /api/sessions/:id');
    console.log('   - DELETE /api/sessions/:id');
    console.log('   - POST   /api/sessions/:id/games');
    console.log('   - GET    /api/games/all');
    console.log('   - GET    /api/stats');
    console.log('   - GET    /api/stats/health');
});

module.exports = app;