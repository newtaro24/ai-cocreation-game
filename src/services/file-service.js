const fs = require('fs');
const path = require('path');

class FileService {
    constructor() {
        this.dataDir = path.join(__dirname, '../../data');
        this.sessionsDir = path.join(this.dataDir, 'sessions');
    }

    saveGameFile(sessionId, gameData) {
        const { html, prompt, participant, gameIndex } = gameData;
        
        const sessionDir = path.join(this.sessionsDir, sessionId);
        
        if (!fs.existsSync(sessionDir)) {
            throw new Error('セッションが見つかりません');
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
        
        return {
            fileName: gameFileName,
            filePath: `/data/sessions/${sessionId}/${gameFileName}`
        };
    }

    getAllGames() {
        const allGames = [];
        
        // sessionsディレクトリが存在しない場合は空配列を返す
        if (!fs.existsSync(this.sessionsDir)) {
            return allGames;
        }
        
        // 各セッションフォルダをスキャン
        const sessionFolders = fs.readdirSync(this.sessionsDir);
        
        sessionFolders.forEach(sessionId => {
            const sessionDir = path.join(this.sessionsDir, sessionId);
            
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
        
        return allGames;
    }

    getGameFile(sessionId, fileName) {
        const gameFilePath = path.join(this.sessionsDir, sessionId, fileName);
        
        if (!fs.existsSync(gameFilePath)) {
            throw new Error('ゲームファイルが見つかりません');
        }
        
        return fs.readFileSync(gameFilePath, 'utf8');
    }

    deleteGameFile(sessionId, fileName) {
        const gameFilePath = path.join(this.sessionsDir, sessionId, fileName);
        
        if (fs.existsSync(gameFilePath)) {
            fs.unlinkSync(gameFilePath);
            return true;
        } else {
            throw new Error('ゲームファイルが見つかりません');
        }
    }

    cleanupSession(sessionId) {
        const sessionDir = path.join(this.sessionsDir, sessionId);
        
        if (fs.existsSync(sessionDir)) {
            // HTMLファイルのみ削除
            const files = fs.readdirSync(sessionDir);
            files.forEach(fileName => {
                if (fileName.endsWith('.html') && fileName.startsWith('game_')) {
                    const filePath = path.join(sessionDir, fileName);
                    fs.unlinkSync(filePath);
                }
            });
        }
    }
}

module.exports = new FileService();