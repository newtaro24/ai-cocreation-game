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
        const { html, prompt, participant } = gameData;

        // ゲームファイル名を生成（タイムスタンプベース）
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
        const gameFileName = `game_${timestamp}_${participant.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
        const gameFilePath = path.join(this.gamesDir, gameFileName);

        // HTMLコメントにメタデータを埋め込み
        const htmlWithMetadata = `<!--
Participant: ${participant}
Prompt: ${prompt}
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
                    const generatedMatch = content.match(/Generated: (.*)/);

                    allGames.push({
                        fileName: fileName,
                        participant: participantMatch ? participantMatch[1] : 'Unknown',
                        prompt: promptMatch ? promptMatch[1] : 'Unknown',
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

        if (fs.existsSync(this.gamesDir)) {
            const files = fs.readdirSync(this.gamesDir);
            files.forEach(fileName => {
                if (fileName.endsWith('.html') && fileName.startsWith('game_')) {
                    totalGames++;
                    const filePath = path.join(this.gamesDir, fileName);
                    const stats = fs.statSync(filePath);
                    totalFileSize += stats.size;
                }
            });
        }

        return {
            totalGames,
            totalFileSize,
            avgFileSize: totalGames > 0 ? Math.round(totalFileSize / totalGames) : 0
        };
    }
}

module.exports = new FileService();