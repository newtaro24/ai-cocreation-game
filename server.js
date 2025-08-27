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
            console.warn('Vertex AI not configured');
            htmlGame = createErrorGame('Vertex AIが設定されていません');
        } else {
            try {
                htmlGame = await generateGameWithVertexAI(prompt, previousPrompts, theme);
                console.log(`Generated HTML length: ${htmlGame.length}`);
            } catch (error) {
                console.error('Vertex AI error:', error);
                htmlGame = createErrorGame('AI生成エラーが発生しました');
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