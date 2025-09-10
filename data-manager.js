const fs = require('fs');
const path = require('path');

class DataManager {
    constructor() {
        this.dataDir = path.join(__dirname, 'data');
        this.participantsFile = path.join(this.dataDir, 'participants.json');
        this.gameHistoryFile = path.join(this.dataDir, 'game-history.json');
        this.sessionsFile = path.join(this.dataDir, 'sessions.json');
        
        this.ensureDataDirectory();
    }
    
    ensureDataDirectory() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        
        // 初期ファイルを作成
        if (!fs.existsSync(this.participantsFile)) {
            fs.writeFileSync(this.participantsFile, '[]');
        }
        if (!fs.existsSync(this.gameHistoryFile)) {
            fs.writeFileSync(this.gameHistoryFile, '[]');
        }
        if (!fs.existsSync(this.sessionsFile)) {
            fs.writeFileSync(this.sessionsFile, '{}');
        }
    }
    
    // 参加者データの管理
    saveParticipants(sessionId, participants) {
        try {
            const data = this.loadParticipantsData();
            data[sessionId] = participants;
            fs.writeFileSync(this.participantsFile, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving participants:', error);
            return false;
        }
    }
    
    loadParticipants(sessionId) {
        try {
            const data = this.loadParticipantsData();
            return data[sessionId] || [];
        } catch (error) {
            console.error('Error loading participants:', error);
            return [];
        }
    }
    
    loadParticipantsData() {
        try {
            const data = fs.readFileSync(this.participantsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return {};
        }
    }
    
    // ゲーム履歴の管理
    saveGameHistory(sessionId, gameHistory) {
        try {
            const data = this.loadGameHistoryData();
            data[sessionId] = gameHistory;
            fs.writeFileSync(this.gameHistoryFile, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving game history:', error);
            return false;
        }
    }
    
    loadGameHistory(sessionId) {
        try {
            const data = this.loadGameHistoryData();
            return data[sessionId] || [];
        } catch (error) {
            console.error('Error loading game history:', error);
            return [];
        }
    }
    
    loadGameHistoryData() {
        try {
            const data = fs.readFileSync(this.gameHistoryFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return {};
        }
    }
    
    // セッション管理
    saveSession(sessionId, sessionData) {
        try {
            const data = this.loadSessionsData();
            data[sessionId] = {
                ...sessionData,
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(this.sessionsFile, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving session:', error);
            return false;
        }
    }
    
    loadSession(sessionId) {
        try {
            const data = this.loadSessionsData();
            return data[sessionId] || null;
        } catch (error) {
            console.error('Error loading session:', error);
            return null;
        }
    }
    
    loadSessionsData() {
        try {
            const data = fs.readFileSync(this.sessionsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return {};
        }
    }
    
    // セッション一覧の取得
    getAllSessions() {
        try {
            const data = this.loadSessionsData();
            return Object.entries(data).map(([id, session]) => ({
                id,
                ...session
            }));
        } catch (error) {
            console.error('Error loading all sessions:', error);
            return [];
        }
    }
    
    // セッションの削除
    deleteSession(sessionId) {
        try {
            // セッションデータを削除
            const sessionsData = this.loadSessionsData();
            delete sessionsData[sessionId];
            fs.writeFileSync(this.sessionsFile, JSON.stringify(sessionsData, null, 2));
            
            // 参加者データを削除
            const participantsData = this.loadParticipantsData();
            delete participantsData[sessionId];
            fs.writeFileSync(this.participantsFile, JSON.stringify(participantsData, null, 2));
            
            // ゲーム履歴を削除
            const gameHistoryData = this.loadGameHistoryData();
            delete gameHistoryData[sessionId];
            fs.writeFileSync(this.gameHistoryFile, JSON.stringify(gameHistoryData, null, 2));
            
            return true;
        } catch (error) {
            console.error('Error deleting session:', error);
            return false;
        }
    }
    
    // 統計情報の取得
    getStats() {
        try {
            const sessions = this.getAllSessions();
            const totalSessions = sessions.length;
            let totalParticipants = 0;
            let totalGames = 0;
            
            sessions.forEach(session => {
                const participants = this.loadParticipants(session.id);
                const gameHistory = this.loadGameHistory(session.id);
                totalParticipants += participants.length;
                totalGames += gameHistory.length;
            });
            
            return {
                totalSessions,
                totalParticipants,
                totalGames,
                avgParticipantsPerSession: totalSessions > 0 ? (totalParticipants / totalSessions).toFixed(1) : 0,
                avgGamesPerSession: totalSessions > 0 ? (totalGames / totalSessions).toFixed(1) : 0
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            return {
                totalSessions: 0,
                totalParticipants: 0,
                totalGames: 0,
                avgParticipantsPerSession: 0,
                avgGamesPerSession: 0
            };
        }
    }
}

module.exports = DataManager;