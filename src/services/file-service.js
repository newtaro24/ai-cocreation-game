const fs = require('fs');
const path = require('path');

class FileService {
    constructor() {
        this.dataDir = path.join(__dirname, '../../data');
        this.gamesDir = path.join(this.dataDir, 'games');
        this.initializeDataDirectory();
    }

    initializeDataDirectory() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        if (!fs.existsSync(this.gamesDir)) {
            fs.mkdirSync(this.gamesDir, { recursive: true });
        }
    }

    saveGameFile(gameData) {
        const { html, prompt, participant, promptHistory } = gameData;

        // 同じ参加者の既存のゲームファイルを削除
        this.deleteParticipantGames(participant);

        // ゲームファイル名を生成（タイムスタンプベース）
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
        const gameFileName = `game_${timestamp}_${participant.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
        const gameFilePath = path.join(this.gamesDir, gameFileName);

        // プロンプト履歴をJSON形式で保存
        const promptHistoryJson = promptHistory ? JSON.stringify(promptHistory) : '[]';

        // HTMLコメントにメタデータを埋め込み
        const htmlWithMetadata = `<!--
Participant: ${participant}
Prompt: ${prompt}
PromptHistory: ${promptHistoryJson}
Generated: ${new Date().toISOString()}
-->
${html}`;

        // HTMLファイルを保存
        fs.writeFileSync(gameFilePath, htmlWithMetadata, 'utf8');

        return {
            fileName: gameFileName,
            filePath: `/data/games/${gameFileName}`
        };
    }

    // 特定の参加者のゲームファイルをすべて削除
    deleteParticipantGames(participant) {
        if (!fs.existsSync(this.gamesDir)) {
            return;
        }

        const files = fs.readdirSync(this.gamesDir);
        files.forEach(fileName => {
            if (fileName.endsWith('.html') && fileName.startsWith('game_')) {
                try {
                    const filePath = path.join(this.gamesDir, fileName);
                    const content = fs.readFileSync(filePath, 'utf8');
                    const participantMatch = content.match(/Participant: (.*)/);

                    if (participantMatch && participantMatch[1] === participant) {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted previous game file for ${participant}: ${fileName}`);
                    }
                } catch (error) {
                    console.error(`Error processing file ${fileName}:`, error);
                }
            }
        });
    }

    getAllGames() {
        const allGames = [];

        // gamesディレクトリが存在しない場合は空配列を返す
        if (!fs.existsSync(this.gamesDir)) {
            return allGames;
        }

        // HTMLファイルをスキャン
        const files = fs.readdirSync(this.gamesDir);
        files.forEach(fileName => {
            if (fileName.endsWith('.html') && fileName.startsWith('game_')) {
                try {
                    const filePath = path.join(this.gamesDir, fileName);
                    const content = fs.readFileSync(filePath, 'utf8');
                    const stats = fs.statSync(filePath);

                    // HTMLコメントからメタデータを抽出
                    const participantMatch = content.match(/Participant: (.*)/);
                    const promptMatch = content.match(/Prompt: (.*)/);
                    const promptHistoryMatch = content.match(/PromptHistory: (.*)/);
                    const generatedMatch = content.match(/Generated: (.*)/);

                    // プロンプト履歴をJSONから復元
                    let promptHistory = [];
                    if (promptHistoryMatch && promptHistoryMatch[1]) {
                        try {
                            promptHistory = JSON.parse(promptHistoryMatch[1]);
                        } catch (e) {
                            promptHistory = [];
                        }
                    }

                    // 最初のプロンプトを取得（タイトル用）
                    const firstPrompt = promptHistory.length > 0 ? promptHistory[0].prompt : (promptMatch ? promptMatch[1] : 'Unknown');

                    allGames.push({
                        fileName: fileName,
                        participant: participantMatch ? participantMatch[1] : 'Unknown',
                        prompt: promptMatch ? promptMatch[1] : 'Unknown',
                        firstPrompt: firstPrompt,
                        promptHistory: promptHistory,
                        createdAt: generatedMatch ? generatedMatch[1] : stats.birthtime.toISOString(),
                        fileSize: stats.size,
                        url: `/data/games/${fileName}`
                    });

                } catch (error) {
                    console.error(`Error reading game file ${fileName}:`, error);
                }
            }
        });

        // 最新順にソート
        allGames.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return allGames;
    }

    getGameFile(fileName) {
        const gameFilePath = path.join(this.gamesDir, fileName);

        if (!fs.existsSync(gameFilePath)) {
            throw new Error('ゲームファイルが見つかりません');
        }

        return fs.readFileSync(gameFilePath, 'utf8');
    }

    deleteGameFile(fileName) {
        const gameFilePath = path.join(this.gamesDir, fileName);

        if (fs.existsSync(gameFilePath)) {
            fs.unlinkSync(gameFilePath);
            return true;
        } else {
            throw new Error('ゲームファイルが見つかりません');
        }
    }

    getStats() {
        let totalGames = 0;
        let totalFileSize = 0;
        const participants = new Set();

        if (fs.existsSync(this.gamesDir)) {
            const files = fs.readdirSync(this.gamesDir);
            files.forEach(fileName => {
                if (fileName.endsWith('.html') && fileName.startsWith('game_')) {
                    totalGames++;
                    const filePath = path.join(this.gamesDir, fileName);
                    const stats = fs.statSync(filePath);
                    totalFileSize += stats.size;

                    // ファイル内容からメタデータを読み取って参加者を抽出
                    try {
                        const content = fs.readFileSync(filePath, 'utf8');
                        const participantMatch = content.match(/Participant: (.*)/);
                        if (participantMatch && participantMatch[1]) {
                            participants.add(participantMatch[1]);
                        }
                    } catch (error) {
                        // ファイル読み取りエラーは無視
                    }
                }
            });
        }

        return {
            totalGames,
            totalSessions: totalGames, // 現在の実装では1ゲーム=1セッション
            totalParticipants: participants.size,
            totalFileSize,
            avgFileSize: totalGames > 0 ? Math.round(totalFileSize / totalGames) : 0
        };
    }

    /**
     * スコアリング用ゲーム情報取得
     */
    getGameInfo(gameId) {
        const gameFilePath = path.join(this.gamesDir, gameId);

        if (!fs.existsSync(gameFilePath)) {
            return null;
        }

        try {
            const content = fs.readFileSync(gameFilePath, 'utf8');
            const stats = fs.statSync(gameFilePath);

            // HTMLコメントからメタデータを抽出
            const participantMatch = content.match(/Participant: (.*)/);
            const promptMatch = content.match(/Prompt: (.*)/);
            const promptHistoryMatch = content.match(/PromptHistory: (.*)/);
            const generatedMatch = content.match(/Generated: (.*)/);

            // プロンプト履歴をJSONから復元
            let promptHistory = [];
            if (promptHistoryMatch && promptHistoryMatch[1]) {
                try {
                    promptHistory = JSON.parse(promptHistoryMatch[1]);
                } catch (e) {
                    promptHistory = [];
                }
            }

            return {
                gameId,
                participant: participantMatch ? participantMatch[1] : 'Unknown',
                prompt: promptMatch ? promptMatch[1] : 'Unknown',
                promptHistory: promptHistory,
                createdAt: generatedMatch ? generatedMatch[1] : stats.birthtime.toISOString(),
                fileSize: stats.size,
                htmlContent: content
            };

        } catch (error) {
            console.error(`Error reading game file ${gameId}:`, error);
            return null;
        }
    }
}

module.exports = new FileService();