const { VertexAI } = require('@google-cloud/vertexai');
const path = require('path');
const { AI_CONFIG, SYSTEM_PROMPT } = require('../config/ai-config');

class AIService {
    constructor() {
        this.vertex_ai = null;
        this.model = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
            }
            
            this.vertex_ai = new VertexAI({ 
                project: AI_CONFIG.projectId, 
                location: AI_CONFIG.location 
            });
            
            const generativeModel = this.vertex_ai.getGenerativeModel({
                model: AI_CONFIG.modelName,
                generationConfig: AI_CONFIG.generationConfig,
            });
            
            this.model = generativeModel;
            this.initialized = true;
            
            console.log('Vertex AI initialized successfully');
            console.log(`Using model: ${AI_CONFIG.modelName} in ${AI_CONFIG.location}`);
        } catch (error) {
            console.error('Failed to initialize Vertex AI:', error);
            throw error;
        }
    }

    async generateGame(prompt, previousPrompts = [], theme = '') {
        if (!this.initialized || !this.model) {
            throw new Error('AI Service not initialized');
        }

        try {
            let fullPrompt = SYSTEM_PROMPT + '\n\n';
            
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
            
            const result = await this.model.generateContent(request);
            const response = result.response;
            
            return this.processResponse(response);
            
        } catch (error) {
            console.error('Vertex AI generation error:', error);
            throw error;
        }
    }

    processResponse(response) {
        if (!response.candidates || response.candidates.length === 0) {
            console.error('No candidates in response');
            throw new Error('AIからの応答が取得できませんでした');
        }
        
        const candidate = response.candidates[0];
        
        // finishReasonをチェック
        if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
            console.error('Generation stopped unexpectedly:', candidate.finishReason);
            throw new Error(`AI生成が停止しました: ${candidate.finishReason}`);
        }
        
        let content = '';
        
        // 応答構造の柔軟な処理
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
            content = candidate.content.parts[0].text;
        } else if (candidate.text) {
            content = candidate.text;
        } else if (candidate.content && candidate.content.text) {
            content = candidate.content.text;
        } else {
            console.error('No content found in candidate');
            throw new Error('AIからの応答が不完全でした');
        }
        
        if (!content || content.trim().length === 0) {
            console.error('Empty content received');
            throw new Error('AI応答が空でした');
        }
        
        return this.extractHTML(content, candidate.finishReason);
    }

    extractHTML(content, finishReason) {
        // 1. 完全なHTMLドキュメントをチェック
        const doctypeMatch = content.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i);
        if (doctypeMatch) {
            return doctypeMatch[0];
        }
        
        // 2. htmlタグで囲まれたドキュメントをチェック
        const htmlMatch = content.match(/<html[\s\S]*?<\/html>/i);
        if (htmlMatch) {
            return htmlMatch[0];
        }
        
        // 3. コードブロック内のHTMLをチェック
        const codeBlockPatterns = [
            /```html\n([\s\S]*?)\n```/,
            /```html\r?\n([\s\S]*?)\r?\n```/,
            /```\n(<!DOCTYPE html[\s\S]*?)\n```/,
            /```\n(<html[\s\S]*?<\/html>)\n```/
        ];
        
        for (const pattern of codeBlockPatterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        
        // 4. HTMLタグが含まれているかチェック
        if (content.includes('<html') && content.includes('</html>')) {
            return content.trim();
        }
        
        // 5. MAX_TOKENSで不完全なHTMLの修復を試行
        if (finishReason === 'MAX_TOKENS' && content.includes('<html')) {
            console.log('Attempting to fix incomplete HTML due to MAX_TOKENS');
            let fixedHtml = content.trim();
            
            if (!fixedHtml.includes('</body>')) {
                fixedHtml += '\n</body>';
            }
            if (!fixedHtml.includes('</html>')) {
                fixedHtml += '\n</html>';
            }
            if (fixedHtml.includes('<script') && !fixedHtml.includes('</script>')) {
                fixedHtml += '\n</script>';
            }
            
            return fixedHtml;
        }
        
        console.error('No HTML found in generated content');
        throw new Error('生成されたコードからHTMLを抽出できませんでした');
    }

    createErrorGame(message) {
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

    isConfigured() {
        return !!(AI_CONFIG.projectId && this.initialized);
    }
}

module.exports = new AIService();