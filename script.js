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
        this.apiBaseUrl = `http://localhost:${window.location.port || '3000'}`;
        this.currentSessionId = null;
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
        this.initializeGallery();
    }

    
    initializeEventListeners() {
        document.getElementById('start-game').addEventListener('click', () => this.showStartModal());
        document.getElementById('stop-game').addEventListener('click', () => this.stopChallenge());
        document.getElementById('complete-game').addEventListener('click', () => this.completeChallenge());
        document.getElementById('submit-prompt').addEventListener('click', () => this.submitPrompt());
        document.getElementById('new-challenge').addEventListener('click', () => this.resetChallenge());
        
        document.getElementById('prompt-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.submitPrompt();
            }
        });
    }
    
    showStartModal() {
        const modal = document.getElementById('start-modal');
        const input = document.getElementById('participants-input');
        const error = document.getElementById('start-error');
        const cancelBtn = document.getElementById('start-cancel');
        const confirmBtn = document.getElementById('start-confirm');

        // モーダルを表示
        modal.style.display = 'flex';
        input.value = '';
        input.focus();
        error.style.display = 'none';

        // 確認処理
        const handleConfirm = () => {
            const participantsText = input.value.trim();
            
            if (participantsText.length === 0) {
                this.showStartError('参加者名を入力してください');
                return;
            }
            
            // カンマ区切りで参加者を解析
            const names = participantsText.split(',').map(name => name.trim()).filter(name => name.length > 0);
            
            if (names.length === 0) {
                this.showStartError('有効な参加者名を入力してください');
                return;
            }
            
            if (names.length > 10) {
                this.showStartError('参加者は10人まで登録できます');
                return;
            }
            
            // 重複チェック
            const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
            if (duplicates.length > 0) {
                this.showStartError(`重複する参加者名があります: ${duplicates[0]}`);
                return;
            }
            
            // 参加者を登録
            this.participants = names.map(name => ({
                name: name,
                prompts: [],
                joinedAt: new Date()
            }));
            
            this.stats.totalParticipants += names.length;
            this.updateStats();
            this.updateParticipantDisplay();
            this.hideStartModal();
            this.createSession().then(() => this.startChallenge());
        };

        // イベントリスナー設定
        const handleClose = () => this.hideStartModal();
        
        cancelBtn.onclick = handleClose;
        confirmBtn.onclick = handleConfirm;
        
        // Enterキーで確認
        input.onkeydown = (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                handleConfirm();
            }
            if (e.key === 'Escape') {
                handleClose();
            }
        };

        // モーダル外クリックで閉じる
        modal.onclick = (e) => {
            if (e.target === modal) {
                handleClose();
            }
        };
    }

    hideStartModal() {
        const modal = document.getElementById('start-modal');
        modal.style.display = 'none';
        
        // イベントリスナーをクリア
        const cancelBtn = document.getElementById('start-cancel');
        const confirmBtn = document.getElementById('start-confirm');
        const input = document.getElementById('participants-input');
        
        cancelBtn.onclick = null;
        confirmBtn.onclick = null;
        input.onkeydown = null;
        modal.onclick = null;
    }

    showStartError(message) {
        const error = document.getElementById('start-error');
        error.textContent = message;
        error.style.display = 'block';
    }

    // セッション作成
    async createSession() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionName: `ゲームセッション_${new Date().toLocaleString()}`,
                    theme: this.currentTheme
                })
            });

            if (!response.ok) {
                throw new Error('セッション作成エラー');
            }

            const data = await response.json();
            if (data.success) {
                this.currentSessionId = data.session.id;
                await this.saveSessionData();
            }
        } catch (error) {
            console.error('Failed to create session:', error);
            // エラーが発生してもゲームは続行
        }
    }

    // 新しい構造でゲームファイルを保存
    async saveGameFile(html, prompt, participant, gameIndex) {
        if (!this.currentSessionId) {
            console.warn('No session ID available for game file saving');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/sessions/${this.currentSessionId}/games`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    html: html,
                    prompt: prompt,
                    participant: participant,
                    gameIndex: gameIndex
                })
            });

            if (!response.ok) {
                throw new Error('ゲームファイル保存エラー');
            }

            const result = await response.json();
        } catch (error) {
            console.error('Failed to save game file:', error);
        }
    }

    // セッションデータの保存
    async saveSessionData() {
        if (!this.currentSessionId) {
            return;
        }

        try {
            const requestBody = {
                participants: this.participants,
                gameHistory: this.gameHistory,
                gameState: this.gameState
            };
            
            const response = await fetch(`${this.apiBaseUrl}/api/sessions/${this.currentSessionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Response error:', errorText);
                throw new Error(`セッションデータ保存エラー: ${response.status} ${errorText}`);
            }

            const result = await response.json();
        } catch (error) {
            console.error('Failed to save session data:', error);
        }
    }

    startChallenge() {
        if (this.gameState !== 'waiting') return;
        
        this.gameState = 'playing';
        this.timeRemaining = 300;
        this.selectRandomTheme();
        
        document.getElementById('start-game').style.display = 'none';
        document.getElementById('stop-game').style.display = 'inline-block';
        document.getElementById('complete-game').style.display = 'inline-block';
        
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
    

    // シンプルなプロンプト検証
    validatePrompt(prompt) {
        const trimmed = prompt.trim();
        
        if (trimmed.length === 0) {
            return { valid: false, message: 'プロンプトを入力してください' };
        }
        
        if (trimmed.length > 1000) {
            return { valid: false, message: 'プロンプトは1000文字以内で入力してください' };
        }
        
        return { valid: true, sanitized: trimmed };
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
    
    async submitPrompt() {
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
        
        // プロンプトの検証
        const validation = this.validatePrompt(prompt);
        if (!validation.valid) {
            this.showNotification(validation.message, 'error');
            return;
        }
        
        const currentParticipant = this.participants[this.currentParticipantIndex];
        const promptData = {
            participant: currentParticipant.name,
            prompt: validation.sanitized, // サニタイズされたプロンプトを使用
            timestamp: new Date().toLocaleTimeString(),
            order: this.prompts.length + 1
        };
        
        this.prompts.push(promptData);
        currentParticipant.prompts.push(promptData);
        
        this.addToHistory(promptData);
        
        // ゲーム生成（現在の参加者情報を保持してから次の参加者に移る）
        await this.generateGameResult(validation.sanitized, currentParticipant.name);
        
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
    
    async generateGameResult(prompt, participantName) {
        const resultContainer = document.getElementById('result');
        
        resultContainer.innerHTML = '<div class="loading"></div><p>AIがゲームを生成中...</p>';
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/generate-game`, {
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
                    participant: participantName  // 正しい参加者名を使用
                });
                
                this.stats.gamesCreated++;
                this.updateStats();
                
                // データを保存（従来の方式）
                await this.saveSessionData();
                
                // 新しい構造でもHTMLファイルを保存
                await this.saveGameFile(data.html, prompt, participantName, this.gameHistory.length);
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
    }
    
    disableInputs() {
        document.getElementById('prompt-input').disabled = true;
        document.getElementById('submit-prompt').disabled = true;
    }
    
    stopChallenge() {
        if (this.gameState !== 'playing') return;
        
        const confirmed = confirm('チャレンジを中断しますか？\n現在の進捗はリセットされます。');
        if (!confirmed) return;
        
        this.gameState = 'stopped';
        clearInterval(this.timerInterval);
        
        this.disableInputs();
        document.querySelector('.timer').classList.remove('pulse');
        
        document.getElementById('start-game').style.display = 'inline-block';
        document.getElementById('start-game').disabled = false;
        document.getElementById('start-game').textContent = 'チャレンジ開始';
        document.getElementById('stop-game').style.display = 'none';
        document.getElementById('complete-game').style.display = 'none';
        
        this.showNotification('チャレンジを中断しました', 'warning');
        this.resetChallenge();
    }
    
    completeChallenge() {
        if (this.gameState !== 'playing') return;
        
        const confirmed = confirm('チャレンジを今すぐ完了しますか？\nこれ以上の編集はできなくなります。');
        if (!confirmed) return;
        
        this.endChallenge();
    }
    
    async endChallenge() {
        this.gameState = 'finished';
        clearInterval(this.timerInterval);
        
        this.disableInputs();
        document.querySelector('.timer').classList.remove('pulse');
        
        document.getElementById('stop-game').style.display = 'none';
        document.getElementById('complete-game').style.display = 'none';
        
        this.showShowcase();
        
        // 最終データを保存
        await this.saveSessionData();
        
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
    
    // ギャラリー機能の初期化
    initializeGallery() {
        const loadGalleryBtn = document.getElementById('load-gallery');
        const hideGalleryBtn = document.getElementById('hide-gallery');
        
        loadGalleryBtn.addEventListener('click', () => this.loadGameGallery());
        hideGalleryBtn.addEventListener('click', () => this.hideGameGallery());
    }
    
    // ゲームギャラリーを読み込み
    async loadGameGallery() {
        const gallerySection = document.getElementById('game-gallery-section');
        const galleryContent = document.getElementById('gallery-content');
        const loadBtn = document.getElementById('load-gallery');
        const hideBtn = document.getElementById('hide-gallery');
        
        // ローディング表示
        galleryContent.innerHTML = '<div class="gallery-loading">🔄 ゲーム履歴を読み込み中...</div>';
        gallerySection.style.display = 'block';
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/games/all`);
            
            if (!response.ok) {
                throw new Error('ゲーム履歴の取得に失敗しました');
            }
            
            const data = await response.json();
            
            if (data.success && data.games.length > 0) {
                this.displayGameGallery(data.games);
                loadBtn.style.display = 'none';
                hideBtn.style.display = 'inline-block';
            } else {
                galleryContent.innerHTML = '<div class="gallery-empty">📝 まだゲームが作成されていません。<br>チャレンジを完了するとここに表示されます！</div>';
            }
            
        } catch (error) {
            console.error('Failed to load game gallery:', error);
            galleryContent.innerHTML = '<div class="gallery-empty">❌ ゲーム履歴の読み込みに失敗しました。</div>';
        }
    }
    
    // ゲームギャラリーを表示
    displayGameGallery(games) {
        const galleryContent = document.getElementById('gallery-content');
        
        const galleryGrid = document.createElement('div');
        galleryGrid.className = 'gallery-grid';
        
        games.forEach(game => {
            const gameCard = document.createElement('div');
            gameCard.className = 'game-card';
            gameCard.onclick = () => this.playGameFile(game);
            
            const date = new Date(game.createdAt).toLocaleDateString('ja-JP');
            const time = new Date(game.createdAt).toLocaleTimeString('ja-JP', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const fileSizeKB = Math.round(game.fileSize / 1024);
            
            gameCard.innerHTML = `
                <div class="game-card-header">
                    <h3 class="game-card-title">🎮 ${game.prompt.substring(0, 30)}${game.prompt.length > 30 ? '...' : ''}</h3>
                    <div class="game-card-date">${date} ${time}</div>
                </div>
                <div class="game-card-meta">
                    <div class="game-card-participant">👤 ${game.participant} | 📁 ${game.fileName} (${fileSizeKB}KB)</div>
                    <div class="game-card-session">🎯 ${game.sessionTheme} | 📂 ${game.sessionName}</div>
                </div>
                <div class="game-card-prompt">${game.prompt}</div>
            `;
            
            galleryGrid.appendChild(gameCard);
        });
        
        galleryContent.innerHTML = '';
        galleryContent.appendChild(galleryGrid);
    }
    
    // ゲームギャラリーを隠す
    hideGameGallery() {
        const gallerySection = document.getElementById('game-gallery-section');
        const loadBtn = document.getElementById('load-gallery');
        const hideBtn = document.getElementById('hide-gallery');
        
        gallerySection.style.display = 'none';
        loadBtn.style.display = 'inline-block';
        hideBtn.style.display = 'none';
    }
    
    // 過去のゲームをプレイ（HTMLファイル版）
    playGameFile(game) {
        // 新しいウィンドウでHTMLファイルを開く
        const gameWindow = window.open(game.url, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
        if (gameWindow) {
            gameWindow.document.title = `${game.prompt}`;
        }
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