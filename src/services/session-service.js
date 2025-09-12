const fs = require('fs');
const path = require('path');

class SessionService {
    constructor() {
        this.dataDir = path.join(__dirname, '../../data');
        this.sessionsDir = path.join(this.dataDir, 'sessions');
        this.initializeDataDirectory();
    }

    initializeDataDirectory() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }

    createSession(sessionName, theme) {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:T]/g, '').split('.')[0];
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
        
        const sessionDir = path.join(this.sessionsDir, sessionId);
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        // session.jsonを保存
        fs.writeFileSync(
            path.join(sessionDir, 'session.json'),
            JSON.stringify(sessionData, null, 2)
        );
        
        return sessionData;
    }

    getAllSessions() {
        const sessions = {};
        
        if (fs.existsSync(this.sessionsDir)) {
            const sessionFolders = fs.readdirSync(this.sessionsDir);
            
            sessionFolders.forEach(sessionId => {
                const sessionDir = path.join(this.sessionsDir, sessionId);
                const sessionJsonPath = path.join(sessionDir, 'session.json');
                
                if (fs.existsSync(sessionJsonPath) && fs.statSync(sessionDir).isDirectory()) {
                    const sessionData = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf8'));
                    sessions[sessionId] = sessionData;
                }
            });
        }
        
        return sessions;
    }

    getSession(sessionId) {
        const sessionDir = path.join(this.sessionsDir, sessionId);
        const sessionJsonPath = path.join(sessionDir, 'session.json');
        
        if (!fs.existsSync(sessionJsonPath)) {
            return null;
        }
        
        const session = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf8'));
        
        // 参加者情報を読み込み
        const participantsJsonPath = path.join(sessionDir, 'participants.json');
        let participants = [];
        if (fs.existsSync(participantsJsonPath)) {
            participants = JSON.parse(fs.readFileSync(participantsJsonPath, 'utf8'));
        }
        
        // ゲーム履歴をHTMLファイルから構築
        const gameHistory = [];
        if (fs.existsSync(sessionDir)) {
            const files = fs.readdirSync(sessionDir);
            files.forEach(fileName => {
                if (fileName.endsWith('.html') && fileName.startsWith('game_')) {
                    const filePath = path.join(sessionDir, fileName);
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    // メタデータを抽出
                    const participantMatch = content.match(/Participant: (.*)/);
                    const promptMatch = content.match(/Prompt: (.*)/);
                    const generatedMatch = content.match(/Generated: (.*)/);
                    
                    gameHistory.push({
                        participant: participantMatch ? participantMatch[1] : 'Unknown',
                        prompt: promptMatch ? promptMatch[1] : 'Unknown',
                        html: content.split('-->')[1]?.trim() || content,
                        timestamp: generatedMatch ? generatedMatch[1] : new Date().toISOString()
                    });
                }
            });
        }
        
        return {
            ...session,
            participants,
            gameHistory
        };
    }

    updateSession(sessionId, updateData) {
        const sessionDir = path.join(this.sessionsDir, sessionId);
        const sessionJsonPath = path.join(sessionDir, 'session.json');
        
        if (!fs.existsSync(sessionJsonPath)) {
            throw new Error('セッションが見つかりません');
        }
        
        const existingSession = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf8'));
        const { participants, gameHistory, gameState } = updateData;
        
        // セッション情報を更新
        const updatedSession = { 
            ...existingSession,
            ...(participants !== undefined && { participants }),
            ...(gameHistory !== undefined && { gameHistory }),
            ...(gameState !== undefined && { gameState }),
            lastUpdated: new Date().toISOString()
        };
        
        // セッションJSONを更新
        fs.writeFileSync(sessionJsonPath, JSON.stringify(updatedSession, null, 2));
        
        // 参加者情報を別途保存
        if (participants !== undefined) {
            fs.writeFileSync(
                path.join(sessionDir, 'participants.json'),
                JSON.stringify(participants, null, 2)
            );
        }
        
        return updatedSession;
    }

    deleteSession(sessionId) {
        const sessionDir = path.join(this.sessionsDir, sessionId);
        
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
            return true;
        } else {
            throw new Error('セッションが見つかりません');
        }
    }

    getStats() {
        let totalSessions = 0;
        let totalParticipants = 0;
        let totalGames = 0;
        
        if (fs.existsSync(this.sessionsDir)) {
            const sessionFolders = fs.readdirSync(this.sessionsDir);
            
            sessionFolders.forEach(sessionId => {
                const sessionDir = path.join(this.sessionsDir, sessionId);
                if (fs.statSync(sessionDir).isDirectory()) {
                    totalSessions++;
                    
                    // 参加者数をカウント
                    const participantsPath = path.join(sessionDir, 'participants.json');
                    if (fs.existsSync(participantsPath)) {
                        const participants = JSON.parse(fs.readFileSync(participantsPath, 'utf8'));
                        totalParticipants += participants.length;
                    }
                    
                    // ゲーム数をカウント
                    const files = fs.readdirSync(sessionDir);
                    files.forEach(fileName => {
                        if (fileName.endsWith('.html') && fileName.startsWith('game_')) {
                            totalGames++;
                        }
                    });
                }
            });
        }
        
        return {
            totalSessions,
            totalParticipants,
            totalGames,
            avgParticipantsPerSession: totalSessions > 0 ? (totalParticipants / totalSessions).toFixed(1) : 0,
            avgGamesPerSession: totalSessions > 0 ? (totalGames / totalSessions).toFixed(1) : 0
        };
    }
}

module.exports = new SessionService();