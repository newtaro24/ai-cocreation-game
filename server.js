const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { VertexAI } = require('@google-cloud/vertexai');
const DataManager = require('./data-manager');

const app = express();
const PORT = process.env.PORT || 3000;

// DataManagerのインスタンスを作成
const dataManager = new DataManager();

// ローカル開発専用のシンプルなCORS設定
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));
app.use('/games', express.static(path.join(__dirname, 'games')));
app.use('/data/sessions', express.static(path.join(__dirname, 'data', 'sessions')));

const projectId = process.env.PROJECT_ID;
const location = process.env.LOCATION || 'us-central1';
const modelName = process.env.MODEL_NAME || 'gemini-1.5-flash';

let vertex_ai;
let model;

async function initializeVertexAI() {
    try {
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
        }
        
        vertex_ai = new VertexAI({ project: projectId, location: location });
        
        const generativeModel = vertex_ai.getGenerativeModel({
            model: modelName,
            generationConfig: {
                maxOutputTokens: 8192, // 思考プロセス分を考慮して十分な制限に戻す
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

const systemPrompt = `シンプルなHTMLゲームを作成してください。

要件:
- HTML、CSS、JavaScript のみ
- 1つのファイルで完結
- 日本語UI
- レスポンシブ
- 5秒で楽しめるシンプルなゲーム

出力: <!DOCTYPE html>から始まる完全なHTMLコードのみ。コメントや説明は不要。`;

async function generateGameWithVertexAI(prompt, previousPrompts, theme) {
    try {
        let fullPrompt = systemPrompt + '\n\n';
        
        if (theme) {
            fullPrompt += `テーマ: ${theme}\n`;
        }
        
        // 既存プロンプトは最新3つまでに制限
        if (previousPrompts && previousPrompts.length > 0) {
            const recentPrompts = previousPrompts.slice(-3);
            fullPrompt += '前の改良: ';
            recentPrompts.forEach((p, i) => {
                fullPrompt += `${i + 1}.${p.prompt} `;
            });
            fullPrompt += '\n';
        }
        
        fullPrompt += `指示: ${prompt}\n\nHTML:`;
        
        const request = {
            contents: [
                { role: 'user', parts: [{ text: fullPrompt }] }
            ],
        };
        
        const result = await model.generateContent(request);
        const response = result.response;
        
        // デバッグログ追加
        console.log('AI Response structure:', JSON.stringify({
            candidates: response.candidates?.length,
            finishReason: response.candidates?.[0]?.finishReason,
            hasContent: !!response.candidates?.[0]?.content,
            hasParts: !!response.candidates?.[0]?.content?.parts?.length,
            hasText: !!response.candidates?.[0]?.text,
            hasContentText: !!response.candidates?.[0]?.content?.text
        }, null, 2));
        
        // 完全な応答をログ（MAX_TOKENSの場合のみ）
        if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
            console.log('Full response for MAX_TOKENS:', JSON.stringify(response, null, 2));
        }
        
        if (!response.candidates || response.candidates.length === 0) {
            console.error('No candidates in response');
            return createErrorGame('AIからの応答が取得できませんでした');
        }
        
        const candidate = response.candidates[0];
        
        // finishReasonをチェック（STOPは正常完了、MAX_TOKENSは部分的に処理可能）
        if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
            console.error('Generation stopped unexpectedly:', candidate.finishReason);
            return createErrorGame(`AI生成が停止しました: ${candidate.finishReason}`);
        }
        
        let content = '';
        
        // 応答構造の柔軟な処理
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
            // 通常の構造
            content = candidate.content.parts[0].text;
        } else if (candidate.text) {
            // 代替構造1: candidate.text
            content = candidate.text;
        } else if (candidate.content && candidate.content.text) {
            // 代替構造2: candidate.content.text
            content = candidate.content.text;
        } else {
            console.error('No content found in candidate');
            console.error('Candidate structure:', JSON.stringify(candidate, null, 2));
            return createErrorGame('AIからの応答が不完全でした');
        }
        console.log('Generated content length:', content?.length || 0);
        console.log('Content preview:', content?.substring(0, 200) + '...');
        
        if (!content || content.trim().length === 0) {
            console.error('Empty content received');
            return createErrorGame('AI応答が空でした');
        }
        
        // 1. 完全なHTMLドキュメントをチェック
        const doctypeMatch = content.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i);
        if (doctypeMatch) {
            console.log('Found DOCTYPE HTML document');
            return doctypeMatch[0];
        }
        
        // 2. htmlタグで囲まれたドキュメントをチェック
        const htmlMatch = content.match(/<html[\s\S]*?<\/html>/i);
        if (htmlMatch) {
            console.log('Found HTML document');
            return htmlMatch[0];
        }
        
        // 3. コードブロック内のHTMLをチェック（複数パターン対応）
        const codeBlockPatterns = [
            /```html\n([\s\S]*?)\n```/,
            /```html\r?\n([\s\S]*?)\r?\n```/,
            /```\n(<!DOCTYPE html[\s\S]*?)\n```/,
            /```\n(<html[\s\S]*?<\/html>)\n```/
        ];
        
        for (const pattern of codeBlockPatterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                console.log('Found HTML in code block');
                return match[1];
            }
        }
        
        // 4. HTMLタグが含まれているかチェック
        if (content.includes('<html') && content.includes('</html>')) {
            console.log('Found HTML tags in content');
            return content.trim();
        }
        
        // 5. MAX_TOKENSで不完全なHTMLの修復を試行
        if (candidate.finishReason === 'MAX_TOKENS' && content.includes('<html')) {
            console.log('Attempting to fix incomplete HTML due to MAX_TOKENS');
            let fixedHtml = content.trim();
            
            // 基本的な修復
            if (!fixedHtml.includes('</body>')) {
                fixedHtml += '\n</body>';
            }
            if (!fixedHtml.includes('</html>')) {
                fixedHtml += '\n</html>';
            }
            
            // スクリプトタグが開いたまま残っている場合の修復
            if (fixedHtml.includes('<script') && !fixedHtml.includes('</script>')) {
                fixedHtml += '\n</script>';
            }
            
            console.log('Fixed HTML length:', fixedHtml.length);
            return fixedHtml;
        }
        
        console.error('No HTML found in generated content');
        console.log('Full content:', content);
        return createErrorGame('生成されたコードからHTMLを抽出できませんでした');
        
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


// シンプルな入力検証
function validatePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') {
        return { valid: false, message: 'プロンプトが必要です' };
    }
    
    const trimmed = prompt.trim();
    
    if (trimmed.length === 0) {
        return { valid: false, message: 'プロンプトが必要です' };
    }
    
    if (trimmed.length > 1000) {
        return { valid: false, message: 'プロンプトは1000文字以内で入力してください' };
    }
    
    return { valid: true };
}

app.post('/api/generate-game', async (req, res) => {
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
        
        // 新しい構造でファイル保存（将来実装予定）
        console.log('Game generated successfully, file saving will be implemented in session structure');
        
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

// セッション管理のAPIエンドポイント
app.post('/api/sessions', (req, res) => {
    try {
        const { sessionName, theme } = req.body;
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:T]/g, '').split('.')[0]; // 20250910181814
        const sessionId = `session_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
        
        const sessionData = {
            id: sessionId,
            name: sessionName || `セッション_${new Date().toLocaleString()}`,
            theme: theme || '「5秒で遊べるミニゲーム」を作ろう！',
            createdAt: now.toISOString(),
            gameState: 'waiting',
            participants: [],
            gameHistory: []
        };
        
        // 新しい構造でセッションフォルダを作成
        const sessionDir = path.join(__dirname, 'data', 'sessions', sessionId);
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        // session.jsonを保存
        fs.writeFileSync(
            path.join(sessionDir, 'session.json'),
            JSON.stringify(sessionData, null, 2)
        );
        
        // 従来のデータマネージャーにも保存（後方互換性のため）
        dataManager.saveSession(sessionId, sessionData);
        
        console.log(`New session created: ${sessionId}`);
        res.json({ success: true, session: sessionData });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'セッションの作成に失敗しました' });
    }
});

app.get('/api/sessions', (req, res) => {
    try {
        const sessions = dataManager.getAllSessions();
        res.json({ success: true, sessions });
    } catch (error) {
        console.error('Error loading sessions:', error);
        res.status(500).json({ error: 'セッションの取得に失敗しました' });
    }
});

app.get('/api/sessions/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = dataManager.loadSession(sessionId);
        
        if (!session) {
            return res.status(404).json({ error: 'セッションが見つかりません' });
        }
        
        const participants = dataManager.loadParticipants(sessionId);
        const gameHistory = dataManager.loadGameHistory(sessionId);
        
        res.json({
            success: true,
            session: {
                ...session,
                participants,
                gameHistory
            }
        });
    } catch (error) {
        console.error('Error loading session:', error);
        res.status(500).json({ error: 'セッションの取得に失敗しました' });
    }
});

app.put('/api/sessions/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const { participants, gameHistory, gameState } = req.body;
        
        // セッションの存在確認
        const existingSession = dataManager.loadSession(sessionId);
        if (!existingSession) {
            return res.status(404).json({ error: 'セッションが見つかりません' });
        }
        
        // データを保存
        if (participants !== undefined) {
            dataManager.saveParticipants(sessionId, participants);
        }
        if (gameHistory !== undefined) {
            dataManager.saveGameHistory(sessionId, gameHistory);
        }
        
        // セッション情報を更新（participants/gameHistory含む）
        const updatedSession = { 
            ...existingSession,
            ...(participants !== undefined && { participants }),
            ...(gameHistory !== undefined && { gameHistory }),
            ...(gameState !== undefined && { gameState }),
            lastUpdated: new Date().toISOString()
        };
        
        // 新しい構造でも保存
        const sessionDir = path.join(__dirname, 'data', 'sessions', sessionId);
        if (fs.existsSync(sessionDir)) {
            // セッションJSONを更新
            fs.writeFileSync(
                path.join(sessionDir, 'session.json'),
                JSON.stringify(updatedSession, null, 2)
            );
            
            // 参加者情報を別途保存
            if (participants !== undefined) {
                fs.writeFileSync(
                    path.join(sessionDir, 'participants.json'),
                    JSON.stringify(participants, null, 2)
                );
            }
        }
        
        dataManager.saveSession(sessionId, updatedSession);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating session:', error);
        res.status(500).json({ error: 'セッションの更新に失敗しました' });
    }
});

app.delete('/api/sessions/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const success = dataManager.deleteSession(sessionId);
        
        if (success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'セッションの削除に失敗しました' });
        }
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ error: 'セッションの削除に失敗しました' });
    }
});

// ゲームHTMLファイル保存用エンドポイント
app.post('/api/sessions/:sessionId/games', (req, res) => {
    try {
        const { sessionId } = req.params;
        const { html, prompt, participant, gameIndex } = req.body;
        
        const sessionDir = path.join(__dirname, 'data', 'sessions', sessionId);
        
        if (!fs.existsSync(sessionDir)) {
            return res.status(404).json({ error: 'セッションが見つかりません' });
        }
        
        // ゲームファイル名を生成
        const gameFileName = `game_${String(gameIndex || 1).padStart(3, '0')}_${participant}.html`;
        const gameFilePath = path.join(sessionDir, gameFileName);
        
        // HTMLコメントにメタデータを埋め込み
        const htmlWithMetadata = `<!--
Session ID: ${sessionId}
Participant: ${participant}
Prompt: ${prompt}
Game Index: ${gameIndex || 1}
Generated: ${new Date().toISOString()}
-->
${html}`;
        
        // HTMLファイルを保存
        fs.writeFileSync(gameFilePath, htmlWithMetadata, 'utf8');
        
        console.log(`Game saved: ${gameFileName} in session ${sessionId}`);
        
        res.json({ 
            success: true, 
            fileName: gameFileName,
            filePath: `/data/sessions/${sessionId}/${gameFileName}`
        });
        
    } catch (error) {
        console.error('Error saving game file:', error);
        res.status(500).json({ error: 'ゲームファイルの保存に失敗しました' });
    }
});

app.get('/api/stats', (req, res) => {
    try {
        const stats = dataManager.getStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: '統計の取得に失敗しました' });
    }
});

// 新しい構造で全てのゲームファイルを取得
app.get('/api/games/all', (req, res) => {
    try {
        const sessionsDir = path.join(__dirname, 'data', 'sessions');
        const allGames = [];
        
        // sessionsディレクトリが存在しない場合は空配列を返す
        if (!fs.existsSync(sessionsDir)) {
            return res.json({ success: true, games: [] });
        }
        
        // 各セッションフォルダをスキャン
        const sessionFolders = fs.readdirSync(sessionsDir);
        
        sessionFolders.forEach(sessionId => {
            const sessionDir = path.join(sessionsDir, sessionId);
            
            if (fs.statSync(sessionDir).isDirectory()) {
                try {
                    // session.jsonを読み込み
                    const sessionJsonPath = path.join(sessionDir, 'session.json');
                    let sessionData = {};
                    
                    if (fs.existsSync(sessionJsonPath)) {
                        sessionData = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf8'));
                    }
                    
                    // HTMLファイルをスキャン
                    const files = fs.readdirSync(sessionDir);
                    files.forEach(fileName => {
                        if (fileName.endsWith('.html') && fileName.startsWith('game_')) {
                            try {
                                const filePath = path.join(sessionDir, fileName);
                                const content = fs.readFileSync(filePath, 'utf8');
                                const stats = fs.statSync(filePath);
                                
                                // HTMLコメントからメタデータを抽出
                                const sessionIdMatch = content.match(/Session ID: (.*)/);
                                const participantMatch = content.match(/Participant: (.*)/);
                                const promptMatch = content.match(/Prompt: (.*)/);
                                const gameIndexMatch = content.match(/Game Index: (.*)/);
                                const generatedMatch = content.match(/Generated: (.*)/);
                                
                                allGames.push({
                                    sessionId: sessionIdMatch ? sessionIdMatch[1] : sessionId,
                                    sessionName: sessionData.name || 'Unknown Session',
                                    sessionTheme: sessionData.theme || 'Unknown Theme',
                                    fileName: fileName,
                                    participant: participantMatch ? participantMatch[1] : 'Unknown',
                                    prompt: promptMatch ? promptMatch[1] : 'Unknown',
                                    gameIndex: gameIndexMatch ? parseInt(gameIndexMatch[1]) : 1,
                                    createdAt: generatedMatch ? generatedMatch[1] : stats.birthtime.toISOString(),
                                    fileSize: stats.size,
                                    url: `/data/sessions/${sessionId}/${fileName}`
                                });
                                
                            } catch (error) {
                                console.error(`Error reading game file ${fileName}:`, error);
                            }
                        }
                    });
                } catch (error) {
                    console.error(`Error processing session ${sessionId}:`, error);
                }
            }
        });
        
        // 最新順にソート
        allGames.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({ success: true, games: allGames });
    } catch (error) {
        console.error('Error getting game files:', error);
        res.status(500).json({ error: 'ゲームファイルの取得に失敗しました' });
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
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`🤖 Vertex AI Project: ${projectId || 'not configured'}`);
    console.log(`📍 Location: ${location}`);
    console.log(`🧠 Model: ${modelName}`);
    
    if (!projectId || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.warn('⚠️  Vertex AI設定が完了していません');
        console.warn('   .envファイルでPROJECT_IDとGOOGLE_APPLICATION_CREDENTIALSを設定してください');
    } else {
        console.log('✅ Vertex AI設定完了');
    }
});