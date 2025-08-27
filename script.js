class AIGameChallenge {
    constructor() {
        this.gameState = 'waiting';
        this.timeRemaining = 300;
        this.timerInterval = null;
        this.currentTheme = '「5秒で遊べるミニゲーム」を作ろう！';
        this.participants = [];
        this.currentParticipantIndex = 0;
        this.prompts = [];
        this.gameHistory = [];
        this.stats = {
            totalPrompts: 0,
            totalParticipants: 0,
            gamesCreated: 0
        };
        
        this.themes = [
            '「5秒で遊べるミニゲーム」を作ろう！',
            '「一番シンプルなパズルゲーム」を作ろう！',
            '「反射神経を試すゲーム」を作ろう！',
            '「運だけで勝負するゲーム」を作ろう！',
            '「音を使ったリズムゲーム」を作ろう！',
            '「色を使った記憶ゲーム」を作ろう！',
            '「数字を使った計算ゲーム」を作ろう！'
        ];
        
        this.initializeEventListeners();
        this.updateStats();
    }
    
    initializeEventListeners() {
        document.getElementById('start-game').addEventListener('click', () => this.startChallenge());
        document.getElementById('submit-prompt').addEventListener('click', () => this.submitPrompt());
        document.getElementById('add-participant').addEventListener('click', () => this.addParticipant());
        document.getElementById('new-challenge').addEventListener('click', () => this.resetChallenge());
        document.getElementById('share-game').addEventListener('click', () => this.shareGame());
        
        document.getElementById('prompt-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.submitPrompt();
            }
        });
    }
    
    startChallenge() {
        if (this.gameState !== 'waiting') return;
        
        if (this.participants.length === 0) {
            this.showNotification('参加者を追加してください', 'warning');
            return;
        }
        
        this.gameState = 'playing';
        this.timeRemaining = 300;
        this.selectRandomTheme();
        
        document.getElementById('start-game').disabled = true;
        document.getElementById('start-game').textContent = 'チャレンジ進行中...';
        
        this.enableInputs();
        this.startTimer();
        this.updateCurrentParticipant();
        
        this.showNotification('チャレンジ開始！みんなで協力してゲームを作りましょう！', 'success');
    }
    
    selectRandomTheme() {
        const randomIndex = Math.floor(Math.random() * this.themes.length);
        this.currentTheme = this.themes[randomIndex];
        document.getElementById('current-theme').textContent = this.currentTheme;
    }
    
    addParticipant() {
        const name = prompt('参加者の名前を入力してください:');
        if (!name || name.trim() === '') return;
        
        const participantName = name.trim();
        if (this.participants.some(p => p.name === participantName)) {
            this.showNotification('既に同じ名前の参加者がいます', 'warning');
            return;
        }
        
        this.participants.push({
            name: participantName,
            prompts: [],
            joinedAt: new Date()
        });
        
        this.stats.totalParticipants++;
        this.updateStats();
        this.updateParticipantDisplay();
        this.showNotification(`${participantName}さんが参加しました！`, 'success');
    }
    
    updateParticipantDisplay() {
        document.getElementById('participant-count').textContent = this.participants.length;
        
        if (this.participants.length > 0 && this.gameState === 'playing') {
            this.updateCurrentParticipant();
        }
    }
    
    updateCurrentParticipant() {
        if (this.participants.length === 0) {
            document.getElementById('current-player').textContent = '待機中...';
            return;
        }
        
        const currentParticipant = this.participants[this.currentParticipantIndex];
        document.getElementById('current-player').textContent = currentParticipant.name;
    }
    
    submitPrompt() {
        if (this.gameState !== 'playing') {
            this.showNotification('チャレンジが開始されていません', 'warning');
            return;
        }
        
        if (this.participants.length === 0) {
            this.showNotification('参加者がいません', 'warning');
            return;
        }
        
        const promptInput = document.getElementById('prompt-input');
        const prompt = promptInput.value.trim();
        
        if (!prompt) {
            this.showNotification('プロンプトを入力してください', 'error');
            return;
        }
        
        const currentParticipant = this.participants[this.currentParticipantIndex];
        const promptData = {
            participant: currentParticipant.name,
            prompt: prompt,
            timestamp: new Date().toLocaleTimeString(),
            order: this.prompts.length + 1
        };
        
        this.prompts.push(promptData);
        currentParticipant.prompts.push(promptData);
        
        this.addToHistory(promptData);
        this.generateGameResult(prompt);
        
        promptInput.value = '';
        this.currentParticipantIndex = (this.currentParticipantIndex + 1) % this.participants.length;
        this.updateCurrentParticipant();
        
        this.stats.totalPrompts++;
        this.updateStats();
        
        this.showNotification(`${currentParticipant.name}さんのプロンプトを送信しました！`, 'info');
    }
    
    addToHistory(promptData) {
        const historyContainer = document.getElementById('history');
        
        const emptyMessage = historyContainer.querySelector('.empty-message');
        if (emptyMessage) {
            emptyMessage.remove();
        }
        
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div class="participant-name">${promptData.participant}</div>
            <div class="timestamp">${promptData.timestamp}</div>
            <div>${promptData.prompt}</div>
        `;
        historyContainer.appendChild(historyItem);
        historyContainer.scrollTop = historyContainer.scrollHeight;
    }
    
    async generateGameResult(prompt) {
        const resultContainer = document.getElementById('result');
        
        resultContainer.innerHTML = '<div class="loading"></div><p>AIがゲームを生成中...</p>';
        
        try {
            const response = await fetch('http://localhost:3000/api/generate-game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt,
                    previousPrompts: this.prompts.slice(0, -1),
                    theme: this.currentTheme
                })
            });
            
            if (!response.ok) {
                throw new Error('AI生成エラー');
            }
            
            const data = await response.json();
            
            if (data.success && data.html) {
                const iframe = document.createElement('iframe');
                iframe.style.width = '100%';
                iframe.style.height = '400px';
                iframe.style.border = 'none';
                iframe.style.borderRadius = '8px';
                iframe.srcdoc = data.html;
                
                resultContainer.innerHTML = '';
                resultContainer.appendChild(iframe);
                
                this.gameHistory.push({
                    prompt: prompt,
                    html: data.html,
                    timestamp: new Date(),
                    participant: this.participants[this.currentParticipantIndex].name
                });
                
                this.stats.gamesCreated++;
                this.updateStats();
            } else {
                throw new Error('生成失敗');
            }
            
        } catch (error) {
            console.error('Game generation error:', error);
            resultContainer.innerHTML = `
                <div class="waiting-message">
                    <div class="waiting-icon">⚠️</div>
                    <p>ゲーム生成に失敗しました</p>
                    <p class="hint">別のプロンプトでもう一度お試しください</p>
                </div>
            `;
            this.showNotification('ゲーム生成に失敗しました。別のプロンプトでお試しください', 'error');
        }
    }
    
    
    startTimer() {
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();
            
            if (this.timeRemaining === 30) {
                this.showNotification('残り30秒！最後の仕上げを！', 'warning');
                document.querySelector('.timer').classList.add('pulse');
            }
            
            if (this.timeRemaining <= 0) {
                this.endChallenge();
            }
        }, 1000);
    }
    
    updateTimerDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        document.querySelector('.timer-display').textContent = display;
    }
    
    enableInputs() {
        document.getElementById('prompt-input').disabled = false;
        document.getElementById('submit-prompt').disabled = false;
        document.getElementById('add-participant').disabled = false;
    }
    
    disableInputs() {
        document.getElementById('prompt-input').disabled = true;
        document.getElementById('submit-prompt').disabled = true;
        document.getElementById('add-participant').disabled = true;
    }
    
    endChallenge() {
        this.gameState = 'finished';
        clearInterval(this.timerInterval);
        
        this.disableInputs();
        document.querySelector('.timer').classList.remove('pulse');
        
        this.showShowcase();
        
        this.showNotification('制作時間終了！完成したゲームをご覧ください！', 'info');
        
        setTimeout(() => {
            window.scrollTo({
                top: document.getElementById('showcase-section').offsetTop,
                behavior: 'smooth'
            });
        }, 500);
    }
    
    showShowcase() {
        const showcaseSection = document.getElementById('showcase-section');
        const finalResultContainer = document.getElementById('final-result');
        const creationRecipeContainer = document.getElementById('creation-recipe');
        if (this.gameHistory.length > 0) {
            const latestGame = this.gameHistory[this.gameHistory.length - 1];
            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.height = '400px';
            iframe.style.border = 'none';
            iframe.style.borderRadius = '8px';
            iframe.srcdoc = latestGame.html;
            
            finalResultContainer.innerHTML = '';
            finalResultContainer.appendChild(iframe);
        } else {
            finalResultContainer.innerHTML = '<p>ゲームが生成されませんでした</p>';
        }
        creationRecipeContainer.innerHTML = '';
        this.prompts.forEach((item, index) => {
            const recipeItem = document.createElement('div');
            recipeItem.className = 'recipe-item';
            recipeItem.innerHTML = `
                <strong>ステップ ${index + 1} (${item.participant}):</strong><br>
                <em>${item.timestamp}</em><br>
                ${item.prompt}
            `;
            creationRecipeContainer.appendChild(recipeItem);
        });
        
        showcaseSection.style.display = 'block';
    }
    
    shareGame() {
        if (this.gameHistory.length === 0) {
            this.showNotification('シェアできるゲームがありません', 'warning');
            return;
        }
        
        const recipeText = this.prompts.map((p, i) => 
            `${i + 1}. ${p.participant}: ${p.prompt}`
        ).join('\n');
        
        const shareText = `AIゲーム生成チャレンジで作ったゲーム！\n\n${this.currentTheme}\n\n制作過程:\n${recipeText}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'AIゲーム生成チャレンジ',
                text: shareText,
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(shareText).then(() => {
                this.showNotification('制作過程をクリップボードにコピーしました！', 'success');
            }).catch(() => {
                this.showNotification('共有に失敗しました', 'error');
            });
        }
    }
    
    
    resetChallenge() {
        this.gameState = 'waiting';
        this.timeRemaining = 300;
        this.currentParticipantIndex = 0;
        
        clearInterval(this.timerInterval);
        this.participants = [];
        this.prompts = [];
        this.gameHistory = [];
        document.getElementById('participant-count').textContent = '0';
        document.getElementById('current-player').textContent = '待機中...';
        document.getElementById('history').innerHTML = '<p class="empty-message">まだプロンプトがありません</p>';
        document.getElementById('result').innerHTML = `
            <div class="waiting-message">
                <div class="waiting-icon">🎮</div>
                <p>プロンプトを入力してAIにゲーム作成を依頼しましょう！</p>
                <p class="hint">複数の人が順番にプロンプトを追加して、ゲームを改良していきます</p>
            </div>
        `;
        document.getElementById('prompt-input').value = '';
        
        document.getElementById('showcase-section').style.display = 'none';
        
        document.getElementById('start-game').disabled = false;
        document.getElementById('start-game').textContent = 'チャレンジ開始';
        
        this.updateTimerDisplay();
        this.updateStats();
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        this.showNotification('新しいチャレンジの準備完了！', 'success');
    }
    
    updateStats() {
        document.getElementById('total-prompts').textContent = this.stats.totalPrompts;
        document.getElementById('total-participants').textContent = this.stats.totalParticipants;
        document.getElementById('games-created').textContent = this.stats.gamesCreated;
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            animation: slideIn 0.3s ease;
            font-weight: 500;
            max-width: 300px;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
}
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
const game = new AIGameChallenge();