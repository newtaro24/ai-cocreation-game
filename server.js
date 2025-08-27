const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { VertexAI } = require('@google-cloud/vertexai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const projectId = process.env.PROJECT_ID;
const location = process.env.LOCATION || 'asia-northeast1';
const modelName = process.env.MODEL_NAME || 'gemini-2.5-flash';

let vertex_ai;
let model;

async function initializeVertexAI() {
    try {
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
        }
        
        vertex_ai = new VertexAI({ project: projectId, location: location });
        
        const generativeModel = vertex_ai.preview.getGenerativeModel({
            model: modelName,
            generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.7,
                topP: 0.8,
            },
        });
        
        model = generativeModel;
        console.log('Vertex AI initialized successfully');
        console.log(`Using model: ${modelName} in ${location}`);
    } catch (error) {
        console.error('Failed to initialize Vertex AI:', error);
    }
}

initializeVertexAI();

const systemPrompt = `あなたは5秒で遊べるシンプルなHTMLゲームを作るエキスパートです。

## 重要な指針
- ユーザーの要求を正確に理解し、その通りのゲームを作成してください
- 指定された要素（色、音、操作方法など）は必ず実装してください
- 既存のゲームがある場合は、それを改良・拡張してください

## 技術要件
1. 純粋なHTML、CSS、JavaScriptのみを使用
2. 外部ライブラリは使用しない
3. 1つのHTMLファイルで完結
4. 5秒以内に楽しめるシンプルなゲーム
5. スコアやフィードバックがある
6. モバイルでも遊べるレスポンシブデザイン
7. 日本語のUI

## 出力フォーマット
- 必ず<!DOCTYPE html>から始まる完全なHTMLドキュメント
- コメントや説明は不要、HTMLコードのみ
- 動作するJavaScriptを含める

## ゲーム要素の実装例
- クリックゲーム → onclick、カウンター、タイマー
- 音付きゲーム → Audio API使用
- 色を変える → background-colorの動的変更
- パズル → ドラッグ&ドロップまたはクリック移動
- 反射神経 → setTimeout、ランダムタイミング

ユーザーの要求に忠実に、指定された通りのゲームを作成してください。`;

async function generateGameWithVertexAI(prompt, previousPrompts, theme) {
    try {
        let fullPrompt = systemPrompt + '\n\n';
        
        if (theme) {
            fullPrompt += `テーマ: ${theme}\n\n`;
        }
        
        if (previousPrompts && previousPrompts.length > 0) {
            fullPrompt += '## 既存のゲーム改良履歴\n';
            fullPrompt += 'これまでに以下の指示でゲームを改良してきました：\n';
            previousPrompts.forEach((p, i) => {
                fullPrompt += `ステップ${i + 1}: ${p.prompt}\n`;
            });
            fullPrompt += '\n## 新しい改良指示\n';
        } else {
            fullPrompt += '## ゲーム作成指示\n';
        }
        
        fullPrompt += `${prompt}\n\n`;
        fullPrompt += `## 実装指示
- 上記の指示を正確に理解し、指定された通りの機能を実装してください
- 既存の改良履歴がある場合は、それらの要素を保持しつつ新しい要素を追加してください
- 動作テスト済みの完全なHTMLゲームコードを出力してください
- ユーザーの要求に100%応えることが最優先です

出力: 完全に動作するHTMLコードのみ`;
        
        const request = {
            contents: [
                { role: 'user', parts: [{ text: fullPrompt }] }
            ],
        };
        
        const result = await model.generateContent(request);
        const response = result.response;
        const content = response.candidates[0].content.parts[0].text;
        
        const htmlMatch = content.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i) || 
                         content.match(/<html[\s\S]*?<\/html>/i);
        
        if (htmlMatch) {
            return htmlMatch[0];
        }
        
        const codeBlockMatch = content.match(/```html\n([\s\S]*?)\n```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1];
        }
        
        if (content.includes('<html') && content.includes('</html>')) {
            return content;
        }
        
        return createErrorGame('生成されたコードが不完全でした');
        
    } catch (error) {
        console.error('Vertex AI generation error:', error);
        throw error;
    }
}

function createErrorGame(message) {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>生成エラー</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .error-container {
            background: white;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h2 {
            color: #e74c3c;
            margin-bottom: 10px;
        }
        p {
            color: #555;
            margin: 10px 0;
        }
        button {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin-top: 15px;
        }
        button:hover {
            background: #5a67d8;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <h2>⚠️ ゲーム生成エラー</h2>
        <p>${message}</p>
        <p>別のプロンプトでもう一度お試しください。</p>
        <button onclick="location.reload()">リロード</button>
    </div>
</body>
</html>`;
}

function createSampleGame(prompt) {
    const games = [
        {
            name: 'クリックスピード',
            html: `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>クリックスピードゲーム</title>
    <style>
        body {
            font-family: sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea, #764ba2);
        }
        .game-container {
            background: white;
            padding: 30px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h1 {
            color: #667eea;
            margin-bottom: 20px;
        }
        #click-button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 20px 40px;
            font-size: 24px;
            border-radius: 10px;
            cursor: pointer;
            transition: transform 0.1s;
        }
        #click-button:active {
            transform: scale(0.95);
        }
        #click-button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .score {
            font-size: 48px;
            color: #667eea;
            margin: 20px 0;
        }
        .timer {
            font-size: 24px;
            color: #555;
        }
        #start-button {
            background: #667eea;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 18px;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="game-container">
        <h1>🎯 5秒クリックチャレンジ</h1>
        <div class="timer">残り時間: <span id="time">5</span>秒</div>
        <div class="score">スコア: <span id="score">0</span></div>
        <button id="click-button" disabled>クリック！</button>
        <br>
        <button id="start-button" onclick="startGame()">ゲーム開始</button>
    </div>
    <script>
        let score = 0;
        let timeLeft = 5;
        let gameActive = false;
        let timer;

        function startGame() {
            score = 0;
            timeLeft = 5;
            gameActive = true;
            document.getElementById('score').textContent = score;
            document.getElementById('time').textContent = timeLeft;
            document.getElementById('click-button').disabled = false;
            document.getElementById('start-button').disabled = true;
            
            timer = setInterval(() => {
                timeLeft--;
                document.getElementById('time').textContent = timeLeft;
                if (timeLeft <= 0) {
                    endGame();
                }
            }, 1000);
        }

        function endGame() {
            gameActive = false;
            clearInterval(timer);
            document.getElementById('click-button').disabled = true;
            document.getElementById('start-button').disabled = false;
            alert('ゲーム終了！スコア: ' + score + '点');
        }

        document.getElementById('click-button').addEventListener('click', () => {
            if (gameActive) {
                score++;
                document.getElementById('score').textContent = score;
            }
        });
    </script>
</body>
</html>`
        },
        {
            name: 'カラーマッチ',
            html: `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>カラーマッチゲーム</title>
    <style>
        body {
            font-family: sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #ff6b6b, #4ecdc4);
        }
        .game-container {
            background: white;
            padding: 30px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
        }
        #target-color {
            width: 150px;
            height: 150px;
            margin: 20px auto;
            border-radius: 10px;
            border: 3px solid #333;
        }
        .color-buttons {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin: 20px 0;
        }
        .color-btn {
            width: 80px;
            height: 80px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .color-btn:hover {
            transform: scale(1.1);
        }
        .score {
            font-size: 24px;
            margin: 10px 0;
        }
        #message {
            font-size: 18px;
            font-weight: bold;
            height: 30px;
        }
    </style>
</head>
<body>
    <div class="game-container">
        <h1>🎨 カラーマッチ</h1>
        <p>同じ色をクリック！</p>
        <div id="target-color"></div>
        <div class="color-buttons" id="buttons"></div>
        <div class="score">スコア: <span id="score">0</span></div>
        <div id="message"></div>
    </div>
    <script>
        let score = 0;
        let targetColor;
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#F4A460', '#98D8C8'];

        function getRandomColor() {
            return colors[Math.floor(Math.random() * colors.length)];
        }

        function generateRound() {
            targetColor = getRandomColor();
            document.getElementById('target-color').style.backgroundColor = targetColor;
            
            const buttons = document.getElementById('buttons');
            buttons.innerHTML = '';
            
            const buttonColors = [targetColor];
            for (let i = 0; i < 5; i++) {
                buttonColors.push(getRandomColor());
            }
            buttonColors.sort(() => Math.random() - 0.5);
            
            buttonColors.forEach(color => {
                const btn = document.createElement('button');
                btn.className = 'color-btn';
                btn.style.backgroundColor = color;
                btn.onclick = () => checkColor(color);
                buttons.appendChild(btn);
            });
            
            document.getElementById('message').textContent = '';
        }

        function checkColor(color) {
            const message = document.getElementById('message');
            if (color === targetColor) {
                score++;
                document.getElementById('score').textContent = score;
                message.textContent = '正解！';
                message.style.color = '#4CAF50';
                setTimeout(generateRound, 500);
            } else {
                message.textContent = '違う！';
                message.style.color = '#f44336';
            }
        }

        generateRound();
    </script>
</body>
</html>`
        },
        {
            name: 'リアクションゲーム',
            html: `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>反射神経テスト</title>
    <style>
        body {
            font-family: sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #2c3e50, #34495e);
        }
        .game-container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            max-width: 400px;
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 20px;
        }
        #reaction-area {
            width: 300px;
            height: 300px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 20px auto;
            font-size: 24px;
            font-weight: bold;
            color: white;
            cursor: pointer;
            transition: all 0.3s;
        }
        .waiting {
            background: #95a5a6;
        }
        .ready {
            background: #e74c3c;
        }
        .go {
            background: #27ae60;
        }
        .too-early {
            background: #e67e22;
        }
        .result {
            margin: 20px 0;
            font-size: 18px;
            min-height: 50px;
        }
        #start-btn {
            background: #3498db;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
        }
        #best-time {
            margin-top: 20px;
            color: #27ae60;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="game-container">
        <h1>⚡ 反射神経テスト</h1>
        <div id="reaction-area" class="waiting">
            クリックして開始
        </div>
        <div class="result" id="result"></div>
        <div id="best-time">ベストタイム: --ms</div>
        <button id="start-btn" onclick="startGame()">再挑戦</button>
    </div>
    <script>
        let gameState = 'waiting';
        let startTime = 0;
        let bestTime = localStorage.getItem('bestTime') || null;
        
        if (bestTime) {
            document.getElementById('best-time').textContent = 'ベストタイム: ' + bestTime + 'ms';
        }
        
        const area = document.getElementById('reaction-area');
        const result = document.getElementById('result');
        
        function startGame() {
            gameState = 'ready';
            area.className = 'ready';
            area.textContent = '待機中...';
            result.textContent = '緑になったらクリック！';
            
            const delay = 2000 + Math.random() * 3000;
            
            setTimeout(() => {
                if (gameState === 'ready') {
                    gameState = 'go';
                    area.className = 'go';
                    area.textContent = 'クリック！';
                    startTime = Date.now();
                }
            }, delay);
        }
        
        area.addEventListener('click', () => {
            if (gameState === 'waiting') {
                startGame();
            } else if (gameState === 'ready') {
                gameState = 'too-early';
                area.className = 'too-early';
                area.textContent = 'フライング！';
                result.textContent = '早すぎました！もう一度挑戦してください。';
                setTimeout(resetGame, 2000);
            } else if (gameState === 'go') {
                const reactionTime = Date.now() - startTime;
                gameState = 'finished';
                area.className = 'waiting';
                area.textContent = reactionTime + 'ms';
                result.textContent = '素晴らしい反応速度です！';
                
                if (!bestTime || reactionTime < bestTime) {
                    bestTime = reactionTime;
                    localStorage.setItem('bestTime', bestTime);
                    document.getElementById('best-time').textContent = 'ベストタイム: ' + bestTime + 'ms';
                    result.textContent = '🎉 新記録達成！ ' + reactionTime + 'ms';
                }
                
                setTimeout(resetGame, 3000);
            }
        });
        
        function resetGame() {
            gameState = 'waiting';
            area.className = 'waiting';
            area.textContent = 'クリックして開始';
            result.textContent = '';
        }
    </script>
</body>
</html>`
        }
    ];
    
    return games[Math.floor(Math.random() * games.length)].html;
}

app.post('/api/generate-game', async (req, res) => {
    try {
        const { prompt, previousPrompts, theme } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'プロンプトが必要です' });
        }
        
        console.log(`Generating game for prompt: ${prompt}`);
        console.log(`Theme: ${theme || 'none'}`);
        console.log(`Previous prompts: ${previousPrompts?.length || 0}`);
        
        let htmlGame;
        
        if (!projectId || !model) {
            console.warn('Vertex AI not configured, using sample game');
            htmlGame = createSampleGame(prompt);
        } else {
            try {
                htmlGame = await generateGameWithVertexAI(prompt, previousPrompts, theme);
                console.log(`Generated HTML length: ${htmlGame.length}`);
            } catch (error) {
                console.error('Vertex AI error, falling back to sample:', error);
                htmlGame = createSampleGame(prompt);
            }
        }
        
        res.json({ 
            success: true, 
            html: htmlGame,
            provider: model ? 'vertex-ai' : 'sample'
        });
        
    } catch (error) {
        console.error('Error generating game:', error);
        res.status(500).json({ 
            error: 'ゲーム生成中にエラーが発生しました',
            details: error.message 
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        aiProvider: 'vertex-ai',
        projectId: projectId || 'not configured',
        location: location,
        model: modelName,
        configured: !!(projectId && model)
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Vertex AI Project: ${projectId || 'not configured'}`);
    console.log(`Location: ${location}`);
    console.log(`Model: ${modelName}`);
    
    if (!projectId || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.warn('⚠️  Vertex AI not configured. Using sample games.');
        console.warn('Set PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS in .env file');
    }
});