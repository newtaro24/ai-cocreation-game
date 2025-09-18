class AIGameChallenge {
    constructor() {
        this.gameState = 'waiting';
        this.timeRemaining = 300;
        this.timerInterval = null;
        this.currentTheme = '「5秒で遊べるミニゲーム」を作ろう！';
        this.participants = [];
        this.prompts = [];
        this.gameHistory = [];
        this.apiBaseUrl = `http://localhost:${window.location.port || '3000'}`;
        this.currentSessionId = null;
        
        this.themes = [
            {
                title: '「クリック連打ゲーム」を作ろう！',
                requirements: ['クリック可能なボタン', '5秒のタイマー', 'クリック数カウント表示', '結果画面表示'],
                description: '5秒間でできるだけ多くクリックして競うゲーム'
            },
            {
                title: '「色当てクイズゲーム」を作ろう！',
                requirements: ['ランダム色表示', '4つの選択肢', '正答判定機能', 'スコア表示'],
                description: '表示された色の名前を選択肢から選ぶクイズゲーム'
            },
            {
                title: '「反射神経測定ゲーム」を作ろう！',
                requirements: ['ランダムタイミング表示', 'クリック反応時間測定', '結果評価機能', 'もう一度プレイボタン'],
                description: '画面が変化したらすぐクリック！反応速度を競うゲーム'
            },
            {
                title: '「おみくじゲーム」を作ろう！',
                requirements: ['おみくじボタン', 'ランダム結果生成', '運勢表示', 'もう一度引くボタン'],
                description: '運試し！大吉から凶まで、今日の運勢を占うゲーム'
            },
            {
                title: '「記憶力テストゲーム」を作ろう！',
                requirements: ['パターン表示機能', 'ユーザー入力機能', '正誤判定', 'レベル進行システム'],
                description: '表示されたパターンを記憶して再現する記憶力ゲーム'
            },
            {
                title: '「数字足し算ゲーム」を作ろう！',
                requirements: ['ランダム計算問題生成', '回答入力フォーム', '正答判定', '問題数カウント'],
                description: '制限時間内にできるだけ多くの計算問題を解くゲーム'
            }
        ];
        
        this.initializeEventListeners();
        this.initializeGallery();
    }

    
    initializeEventListeners() {
        document.getElementById('start-game').addEventListener('click', () => this.showStartModal());
        document.getElementById('stop-game').addEventListener('click', () => this.stopChallenge());
        document.getElementById('complete-game').addEventListener('click', () => this.completeChallenge());
        document.getElementById('submit-prompt').addEventListener('click', () => this.submitPrompt());
        document.getElementById('view-rules').addEventListener('click', () => window.location.href = '/rules.html');
        document.getElementById('view-gallery').addEventListener('click', () => window.location.href = '/gallery.html');
        document.getElementById('view-ranking').addEventListener('click', () => window.location.href = '/ranking.html');

        document.getElementById('prompt-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.metaKey) {
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
            const consentCheckbox = document.getElementById('public-consent');

            if (participantsText.length === 0) {
                this.showStartError('参加者名を入力してください');
                return;
            }

            if (!consentCheckbox.checked) {
                this.showStartError('公開同意にチェックを入れてください');
                return;
            }

            // 単一参加者の名前をチェック
            const name = participantsText;

            if (name.length > 50) {
                this.showStartError('名前は50文字以内で入力してください');
                return;
            }

            // 参加者を登録（単一参加者）
            this.participants = [{
                name: name,
                prompts: [],
                joinedAt: new Date()
            }];
            
                this.updateParticipantDisplay();
            this.hideStartModal();
            this.startChallenge();
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


    // ゲームファイル保存
    async saveGameFile(html, prompt, participant) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/games/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    html: html,
                    prompt: prompt,
                    participant: participant,
                    promptHistory: this.prompts
                })
            });

            if (!response.ok) {
                throw new Error('ゲームファイル保存エラー');
            }

            const result = await response.json();
            console.log('Game file saved:', result.fileName);
            return result;
        } catch (error) {
            console.error('Failed to save game file:', error);
            return null;
        }
    }

    // スコアリング開始
    async startScoring(gameId) {
        try {
            // スコアリング中の表示
            this.showScoringInProgress();

            // スコアリング実行
            const response = await fetch(`${this.apiBaseUrl}/api/games/${gameId}/score`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    theme: this.currentThemeObj,
                    promptHistory: this.prompts
                })
            });

            if (!response.ok) {
                throw new Error('スコアリング実行エラー');
            }

            const result = await response.json();

            if (result.success) {
                this.showScoreResult(result.score);
            } else {
                this.showScoringError(result.error);
            }

        } catch (error) {
            console.error('Scoring error:', error);
            this.showScoringError('スコアリング中にエラーが発生しました');
        }
    }

    // スコアリング中表示
    showScoringInProgress() {
        const resultDiv = document.getElementById('result');
        resultDiv.innerHTML = `
            <div class="scoring-progress">
                <div class="scoring-icon">🤖</div>
                <h3>AIが採点中...</h3>
                <div class="scoring-loader">
                    <div class="loader-dots">
                        <span></span><span></span><span></span>
                    </div>
                </div>
                <p>ゲームの品質を評価しています。しばらくお待ちください。</p>
            </div>
        `;

        // スコアリング進行表示にスクロール
        setTimeout(() => {
            document.getElementById('result').scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }, 300);
    }

    // スコア結果表示
    showScoreResult(scoreData) {
        const resultDiv = document.getElementById('result');

        // 詳細スコア表示
        const detailScoreHtml = Object.entries(scoreData.detailScores).map(([key, score]) => {
            const labels = {
                requiredFeatures: '機能要件実装度',
                completeness: 'ゲーム完成度',
                uiUx: 'UI/UX品質',
                playability: 'プレイアビリティ',
                creativity: '創造性'
            };
            return `
                <div class="score-detail-item">
                    <span class="score-label">${labels[key] || key}</span>
                    <div class="score-bar">
                        <div class="score-fill" style="width: ${score * 5}%"></div>
                    </div>
                    <span class="score-value">${score}/200</span>
                </div>
            `;
        }).join('');

        resultDiv.innerHTML = `
            <div class="score-result">
                <div class="score-header">
                    <div class="score-icon">🏆</div>
                    <h3>スコア発表！</h3>
                </div>

                <div class="total-score">
                    <div class="score-circle">
                        <span class="score-number">${scoreData.totalScore}</span>
                        <span class="score-label">/1000点</span>
                    </div>
                </div>

                <div class="score-details">
                    <h4>詳細スコア</h4>
                    ${detailScoreHtml}
                </div>

                <div class="ai-comment">
                    <h4>🤖 AIコメント</h4>
                    <p>${scoreData.comment}</p>
                </div>

                <div class="score-actions">
                    <button id="view-rankings" class="btn btn-primary">🏅 ランキングを見る</button>
                    <button id="play-again" class="btn btn-secondary">🎮 もう一度プレイ</button>
                </div>
            </div>
        `;

        // ボタンイベント設定
        document.getElementById('view-rankings').addEventListener('click', () => {
            window.location.href = '/ranking.html';
        });

        document.getElementById('play-again').addEventListener('click', () => {
            this.resetChallenge();
            this.showStartModal();
        });

        // 結果表示にスクロール
        setTimeout(() => {
            document.getElementById('result').scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }, 300);
    }

    // スコアリングエラー表示
    showScoringError(errorMessage) {
        const resultDiv = document.getElementById('result');
        resultDiv.innerHTML = `
            <div class="scoring-error">
                <div class="error-icon">⚠️</div>
                <h3>スコアリングエラー</h3>
                <p>${errorMessage}</p>
                <div class="error-actions">
                    <button id="try-scoring-again" class="btn btn-primary">再試行</button>
                    <button id="skip-scoring" class="btn btn-secondary">スコアリングをスキップ</button>
                </div>
            </div>
        `;

        document.getElementById('skip-scoring').addEventListener('click', () => {
            this.showNotification('スコアリングをスキップしました', 'info');
        });
    }


    startChallenge() {
        if (this.gameState !== 'waiting') return;

        this.gameState = 'playing';
        this.timeRemaining = 300;
        this.selectRandomTheme();

        // お題エリアを表示
        document.getElementById('theme-container').style.display = 'block';

        document.getElementById('start-game').style.display = 'none';
        document.getElementById('stop-game').style.display = 'inline-block';
        document.getElementById('complete-game').style.display = 'inline-block';

        this.enableInputs();
        this.startTimer();
        this.updateCurrentParticipant();

        this.showNotification('チャレンジ開始！ゲームを作りましょう！', 'success');
    }
    
    selectRandomTheme() {
        const randomIndex = Math.floor(Math.random() * this.themes.length);
        this.currentThemeObj = this.themes[randomIndex];
        this.currentTheme = this.currentThemeObj.title; // 後方互換性のため

        const themeElement = document.getElementById('current-theme');
        themeElement.innerHTML = `
            <div class="theme-title">${this.currentThemeObj.title}</div>
            <div class="theme-description">${this.currentThemeObj.description}</div>
            <div class="theme-requirements">
                <strong>機能要件:</strong>
                <ul>
                    ${this.currentThemeObj.requirements.map(req => `<li>${req}</li>`).join('')}
                </ul>
            </div>
        `;
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
        if (this.participants.length > 0) {
            document.getElementById('current-player').textContent = this.participants[0].name;
        } else {
            document.getElementById('current-player').textContent = '待機中...';
        }
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

        // ゲーム表示エリアにスクロール
        setTimeout(() => {
            document.getElementById('result').scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }, 100);
        
        // プロンプトの検証
        const validation = this.validatePrompt(prompt);
        if (!validation.valid) {
            this.showNotification(validation.message, 'error');
            return;
        }
        
        const participant = this.participants[0]; // 単一参加者を使用
        const promptData = {
            participant: participant.name,
            prompt: validation.sanitized, // サニタイズされたプロンプトを使用
            timestamp: new Date().toLocaleTimeString(),
            order: this.prompts.length + 1
        };

        this.prompts.push(promptData);
        participant.prompts.push(promptData);

        this.addToHistory(promptData);

        // ゲーム生成
        await this.generateGameResult(validation.sanitized, participant.name);

        promptInput.value = '';

        this.showNotification(`プロンプトを送信しました！`, 'info');
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
                
                        
                // データを保存（従来の方式）

                // 途中の成果物は保存せず、最新のHTMLを保持のみ
                this.latestGameHtml = data.html;
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

        // 最終ゲームを保存
        let gameId = null;
        if (this.latestGameHtml) {
            const lastParticipant = this.prompts.length > 0 ? this.prompts[this.prompts.length - 1].participant : 'Unknown';
            const saveResult = await this.saveGameFile(this.latestGameHtml, this.getLatestPrompt(), lastParticipant);
            gameId = saveResult?.fileName;
        }

        this.showNotification('制作時間終了！ゲームが完成しました！', 'success');

        // ゲーム表示エリアにフォーカス
        setTimeout(() => {
            document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
        }, 500);

        // スコアリング開始（非同期で実行）
        if (gameId) {
            setTimeout(() => this.startScoring(gameId), 1000);
        }
    }
    
    
    
    
    resetChallenge() {
        this.gameState = 'waiting';
        this.timeRemaining = 300;

        // お題エリアを非表示
        document.getElementById('theme-container').style.display = 'none';

        clearInterval(this.timerInterval);
        this.participants = [];
        this.prompts = [];
        this.gameHistory = [];
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

        document.getElementById('start-game').disabled = false;
        document.getElementById('start-game').textContent = 'チャレンジ開始';
        
        this.updateTimerDisplay();
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        this.showNotification('新しいチャレンジの準備完了！', 'success');
    }

    getLatestPrompt() {
        return this.prompts.length > 0 ? this.prompts[this.prompts.length - 1].prompt : 'ゲーム作成';
    }

    
    // ギャラリー機能の初期化
    initializeGallery() {
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