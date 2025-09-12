/**
 * プロンプト入力の検証
 * @param {string} prompt - 検証するプロンプト
 * @returns {Object} - {valid: boolean, message?: string, sanitized?: string}
 */
function validatePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') {
        return { valid: false, message: 'プロンプトが必要です' };
    }
    
    const trimmed = prompt.trim();
    
    if (trimmed.length === 0) {
        return { valid: false, message: 'プロンプトが必要です' };
    }
    
    if (trimmed.length > 1000) {
        return { valid: false, message: 'プロンプトは1000文字以内で入力してください' };
    }
    
    return { valid: true, sanitized: trimmed };
}

/**
 * セッション名の検証
 * @param {string} sessionName - 検証するセッション名
 * @returns {Object} - {valid: boolean, message?: string, sanitized?: string}
 */
function validateSessionName(sessionName) {
    if (!sessionName || typeof sessionName !== 'string') {
        return { valid: true, sanitized: `セッション_${new Date().toLocaleString()}` };
    }
    
    const trimmed = sessionName.trim();
    
    if (trimmed.length === 0) {
        return { valid: true, sanitized: `セッション_${new Date().toLocaleString()}` };
    }
    
    if (trimmed.length > 100) {
        return { valid: false, message: 'セッション名は100文字以内で入力してください' };
    }
    
    return { valid: true, sanitized: trimmed };
}

/**
 * テーマの検証
 * @param {string} theme - 検証するテーマ
 * @returns {Object} - {valid: boolean, message?: string, sanitized?: string}
 */
function validateTheme(theme) {
    const defaultTheme = '「5秒で遊べるミニゲーム」を作ろう！';
    
    if (!theme || typeof theme !== 'string') {
        return { valid: true, sanitized: defaultTheme };
    }
    
    const trimmed = theme.trim();
    
    if (trimmed.length === 0) {
        return { valid: true, sanitized: defaultTheme };
    }
    
    if (trimmed.length > 200) {
        return { valid: false, message: 'テーマは200文字以内で入力してください' };
    }
    
    return { valid: true, sanitized: trimmed };
}

/**
 * 参加者名の検証
 * @param {string} participantName - 検証する参加者名
 * @returns {Object} - {valid: boolean, message?: string, sanitized?: string}
 */
function validateParticipantName(participantName) {
    if (!participantName || typeof participantName !== 'string') {
        return { valid: false, message: '参加者名が必要です' };
    }
    
    const trimmed = participantName.trim();
    
    if (trimmed.length === 0) {
        return { valid: false, message: '参加者名が必要です' };
    }
    
    if (trimmed.length > 50) {
        return { valid: false, message: '参加者名は50文字以内で入力してください' };
    }
    
    // 特殊文字のチェック（基本的な制限）
    if (!/^[a-zA-Z0-9ぁ-んァ-ヶ一-龯\s\-_]+$/.test(trimmed)) {
        return { valid: false, message: '参加者名に使用できない文字が含まれています' };
    }
    
    return { valid: true, sanitized: trimmed };
}

/**
 * セッションIDの検証
 * @param {string} sessionId - 検証するセッションID
 * @returns {Object} - {valid: boolean, message?: string}
 */
function validateSessionId(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
        return { valid: false, message: 'セッションIDが必要です' };
    }
    
    // session_timestamp_randomstring の形式をチェック
    const sessionIdPattern = /^session_\d{8}_[a-z0-9]+$/;
    
    if (!sessionIdPattern.test(sessionId)) {
        return { valid: false, message: '無効なセッションIDです' };
    }
    
    return { valid: true };
}

/**
 * ファイル名の検証
 * @param {string} fileName - 検証するファイル名
 * @returns {Object} - {valid: boolean, message?: string}
 */
function validateFileName(fileName) {
    if (!fileName || typeof fileName !== 'string') {
        return { valid: false, message: 'ファイル名が必要です' };
    }
    
    // game_xxx_participantname.html の形式をチェック
    const fileNamePattern = /^game_\d{3}_[a-zA-Z0-9ぁ-んァ-ヶ一-龯\s\-_]+\.html$/;
    
    if (!fileNamePattern.test(fileName)) {
        return { valid: false, message: '無効なファイル名です' };
    }
    
    return { valid: true };
}

/**
 * 複数のバリデーション結果をマージ
 * @param {Array} validationResults - バリデーション結果の配列
 * @returns {Object} - 最終的なバリデーション結果
 */
function mergeValidationResults(validationResults) {
    const errors = validationResults
        .filter(result => !result.valid)
        .map(result => result.message);
    
    if (errors.length > 0) {
        return { valid: false, message: errors.join(', ') };
    }
    
    return { valid: true };
}

module.exports = {
    validatePrompt,
    validateSessionName,
    validateTheme,
    validateParticipantName,
    validateSessionId,
    validateFileName,
    mergeValidationResults
};