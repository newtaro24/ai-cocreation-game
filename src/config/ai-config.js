require('dotenv').config();

const AI_CONFIG = {
    projectId: process.env.PROJECT_ID,
    location: process.env.LOCATION || 'us-central1',
    modelName: process.env.MODEL_NAME || 'gemini-1.5-flash',
    generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
        topP: 0.8,
    }
};

const SYSTEM_PROMPT = `シンプルなHTMLゲームを作成してください。

要件:
- HTML、CSS、JavaScript のみ
- 1つのファイルで完結
- 日本語UI
- レスポンシブ
- 5秒で楽しめるシンプルなゲーム

出力: <!DOCTYPE html>から始まる完全なHTMLコードのみ。コメントや説明は不要。`;

module.exports = {
    AI_CONFIG,
    SYSTEM_PROMPT
};