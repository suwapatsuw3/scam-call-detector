/**
 * Scam Guard Demo - Single Page Layout with Audio + Text
 */

// DOM Elements
const audio = document.getElementById('audio-source');
const playBtn = document.getElementById('play-btn');
const restartBtn = document.getElementById('restart-btn');
const seekBar = document.getElementById('seek-bar');
const currentTimeSpan = document.getElementById('current-time');
const totalTimeSpan = document.getElementById('total-time');
const transcriptionBox = document.getElementById('transcription-box');
const connStatus = document.getElementById('connection-status');
const statusIndicator = document.getElementById('status-indicator');
const segmentsCount = document.getElementById('segments-count');
const scamCountEl = document.getElementById('scam-count');

// Text Mode Elements
const textInput = document.getElementById('text-input');
const checkTextBtn = document.getElementById('check-text-btn');
const textResult = document.getElementById('text-result');

// State
let socket = null;
let transcriptBuffer = [];
let displayedIds = new Set();
let isAIReady = false;
let isUserWaiting = false;
let segmentsProcessed = 0;
let scamCount = 0;
let callerIdentified = false;

// ==========================================
// Initialization
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
    setupAudioPlayer();
    setupTextMode();
});

// ==========================================
// WebSocket Connection (Background Process)
// ==========================================
function connectWebSocket() {
    let protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl = `${protocol}//${window.location.host}/ws/analyze`;

    updateConnectionStatus('connecting', 'Connecting...');

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log("WebSocket connected! Waiting for AI to be ready...");
        updateConnectionStatus('processing', 'Loading AI models...');
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // AI Ready - Wait for Play
        if (data.status === 'READY') {
            console.log("AI Ready! Waiting for user to press Play.");
            isAIReady = true;
            updateConnectionStatus('connected', 'Ready - Press Play');
            addLogEntry('SYSTEM', 'AI models loaded. Press Play to start.');
            return;
        }

        if (data.status === 'FINISHED') {
            updateConnectionStatus('connected', 'Analysis Complete');
            addLogEntry('SYSTEM', 'Streaming finished.');
            return;
        }

        // Handle Real-time Logs
        if (data.type === 'log') {
            addLogEntry(data.step, data.message);
            return;
        }

        // Handle result data - push to buffer
        if (data.type === 'result' || data.text) {
            data._id = transcriptBuffer.length;
            transcriptBuffer.push(data);
        }
    };

    socket.onerror = (error) => {
        console.error("WebSocket Error:", error);
        updateConnectionStatus('error', 'Connection Error');
    };

    socket.onclose = () => {
        console.log("WebSocket Closed");
        if (!isAIReady) {
            updateConnectionStatus('error', 'Disconnected');
        }
    };
}

function updateConnectionStatus(type, text) {
    connStatus.className = `connection-badge ${type}`;
    connStatus.querySelector('.status-text').textContent = text;
}

// ==========================================
// Audio Player
// ==========================================
function setupAudioPlayer() {
    audio.addEventListener('loadedmetadata', () => {
        totalTimeSpan.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            seekBar.value = (audio.currentTime / audio.duration) * 100;
            currentTimeSpan.textContent = formatTime(audio.currentTime);
        }

        // Display transcriptions synced with audio
        syncTranscriptions(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
        playBtn.innerHTML = '<span class="play-icon"><i class="fa-solid fa-check"></i></span>';
        playBtn.style.opacity = '1';
        updateStatus('safe', 'Analysis complete');

        // Re-enable seekbar when finished
        seekBar.disabled = false;
        seekBar.style.opacity = '1';
        seekBar.style.cursor = 'pointer';
    });

    seekBar.addEventListener('input', () => {
        let time = (seekBar.value / 100) * audio.duration;
        audio.currentTime = time;
    });

    // Restart Button
    restartBtn.addEventListener('click', () => {
        location.reload(); // Reload page to restart everything
    });
}

playBtn.addEventListener('click', () => {
    // Click once - no pause (to sync with backend)
    if (audio.paused && !playBtn.disabled) {
        if (isAIReady) {
            startPlayback();
            // Disable button after play
            playBtn.disabled = true;
            playBtn.style.opacity = '0.6';
            playBtn.style.cursor = 'not-allowed';
        } else {
            // AI not ready, show loading state
            isUserWaiting = true;
            playBtn.innerHTML = '<span class="play-icon"><i class="fa-solid fa-spinner fa-spin"></i></span>';
            playBtn.disabled = true;
            updateConnectionStatus('processing', 'Waiting for AI...');
        }
    }
});

function startPlayback() {
    // Send "start" signal to backend first!
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: "start" }));
        console.log("Sent start signal to backend");
        addLogEntry('SYSTEM', '▶️ Play pressed! Starting stream...');
    }

    // Change icon to playing (not pause because pause is disabled)
    playBtn.innerHTML = '<span class="play-icon"><i class="fa-solid fa-volume-high"></i></span>';
    playBtn.disabled = true;
    playBtn.style.opacity = '0.7';
    playBtn.style.cursor = 'default';

    // Disable seekbar to prevent timeline seeking
    seekBar.disabled = true;
    seekBar.style.opacity = '0.5';
    seekBar.style.cursor = 'not-allowed';

    audio.play();

    // Remove placeholder
    const placeholder = transcriptionBox.querySelector('.transcription-placeholder');
    if (placeholder) placeholder.remove();

    updateStatus('safe', 'Analyzing audio...');
    updateConnectionStatus('processing', 'Streaming...');
}

// ==========================================
// Transcription Sync
// ==========================================
function syncTranscriptions(currentTime) {
    transcriptBuffer.forEach(item => {
        // Display when audio reaches the end time of each segment
        if (currentTime >= item.end && !displayedIds.has(item._id)) {
            displayedIds.add(item._id);

            // If WARNING from SCAM 3 times -> Show Modal
            if (item.status === 'WARNING' && item.is_warning) {
                showFullWarning(item.reason);
                return;
            }

            addTranscription(item);

            // Update stats
            segmentsProcessed++;
            segmentsCount.textContent = segmentsProcessed;

            // Caller identification
            if (!callerIdentified && segmentsProcessed >= 2 && item.role === 'CALLER') {
                identifyCaller(item.speaker);
            }

            // Scam detection
            if (item.status === 'SCAM') {
                showScamAlert(item);
            } else if (item.status === 'WAIT') {
                updateStatus('warning', `Monitoring... (${Math.round((item.confidence || 0.5) * 100)}%)`);
            } else if (item.role === 'CALLER' && item.status === 'SAFE') {
                updateStatus('safe', `Safe (${Math.round((item.confidence || 0.5) * 100)}%)`);
            }
        }
    });
}

function addTranscription(item) {
    const div = document.createElement('div');
    const roleClass = item.role === 'CALLER' ? 'caller' : 'receiver';
    div.className = `transcription-item ${roleClass}`;

    if (item.status === 'SCAM') {
        div.classList.add('scam');
    }

    let scamHighlight = '';
    if (item.status === 'SCAM' && item.reason) {
        scamHighlight = `
            <div class="scam-highlight">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>${item.reason}</span>
            </div>
        `;
        showToast(item.reason);
    }

    div.innerHTML = `
        <div class="transcription-speaker">
            ${item.role === 'CALLER' ? '📞 Caller' : '👤 Receiver'} (${item.speaker})
        </div>
        <div class="transcription-text">${item.text}</div>
        <div class="transcription-time">${formatTime(item.start)} - ${formatTime(item.end)}</div>
        ${scamHighlight}
    `;

    transcriptionBox.appendChild(div);
    transcriptionBox.scrollTop = transcriptionBox.scrollHeight;
}

function identifyCaller(speakerId) {
    if (callerIdentified) return;

    callerIdentified = true;
    // Log to Caller ID box
    addLogEntry('CALLER', `✅ Identified: ${speakerId}`);
    console.log('Caller identified:', speakerId);
}

function showScamAlert(item) {
    scamCount++;
    scamCountEl.textContent = scamCount;

    updateStatus('danger', `🚨 SCAM! (${Math.round((item.confidence || 0.9) * 100)}%)`);

    // Do not use alertSection - just log in Scam Detector box
    addLogEntry('SCAM', `🚨 SCAM: "${item.text?.substring(0, 50)}..."`);
}

function updateStatus(type, text) {
    statusIndicator.className = `status-indicator status-${type} compact`;
    statusIndicator.querySelector('.status-text').textContent = text;
}

// ==========================================
// Toast Notifications
// ==========================================
function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div class="toast-icon"><i class="fa-solid fa-shield-virus"></i></div>
        <div class="toast-content">
            <h4>SCAM DETECTED!</h4>
            <p>${msg}</p>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
}

// ==========================================
// Full Warning Modal (SCAM 3 ครั้ง)
// ==========================================
function showFullWarning(warningText) {
    // Do not stop audio - keep playing (demo must sync with backend)

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'warning-modal';
    modal.innerHTML = `
        <div class="warning-modal-backdrop"></div>
        <div class="warning-modal-content">
            <div class="warning-modal-header">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <h2>🚨 คำเตือน: ตรวจพบมิจฉาชีพ!</h2>
            </div>
            <div class="warning-modal-body">
                <pre>${warningText}</pre>
            </div>
            <div class="warning-modal-actions">
                <button class="btn-hang-up" onclick="this.closest('.warning-modal').remove()">
                    <i class="fa-solid fa-phone-slash"></i> วางสายทันที
                </button>
                <button class="btn-continue" onclick="this.closest('.warning-modal').remove()">
                    <i class="fa-solid fa-check"></i> รับทราบ
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Update status
    updateStatus('scam', '🚨 SCAM CONFIRMED!');
}

// ==========================================
// Tab Navigation
// ==========================================


// ==========================================
// Utilities
// ==========================================
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ==========================================
// Log Helper (4 separate boxes)
// ==========================================
function addLogEntry(step, message) {
    // Map step to target log box
    let targetId = null;
    let logClass = 'info';

    const stepUpper = step.toUpperCase();

    if (stepUpper === 'ASR' || stepUpper === 'PROCESS') {
        targetId = 'log-asr';
        if (message.includes('✅')) logClass = 'success';
        else if (message.includes('❌')) logClass = 'error';
    } else if (stepUpper === 'CALLER') {
        targetId = 'log-caller';
        if (message.includes('✅')) logClass = 'success';
    } else if (stepUpper === 'BERT' || stepUpper === 'ALERT' || stepUpper === 'SCAM') {
        targetId = 'log-scam';
        if (message.includes('SCAM') || message.includes('🚨')) logClass = 'warning';
        else if (message.includes('SAFE')) logClass = 'success';
    } else if (stepUpper === 'SLM') {
        targetId = 'log-slm';
        if (message.includes('✅')) logClass = 'success';
        else logClass = 'info';
    } else if (stepUpper === 'SYSTEM') {
        // System messages go to all boxes or just console
        console.log(`[${step}] ${message}`);
        return;
    }

    if (!targetId) {
        console.log(`[${step}] ${message}`);
        return;
    }

    const logContainer = document.getElementById(targetId);
    if (!logContainer) {
        console.log(`[${step}] ${message}`);
        return;
    }

    // Remove placeholder if exists
    const placeholder = logContainer.querySelector('.log-placeholder');
    if (placeholder) placeholder.remove();

    // Create log item
    const entry = document.createElement('div');
    entry.className = `log-item ${logClass}`;
    entry.textContent = message;

    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// ==========================================
// Text Mode - Manual Scam Detection
// ==========================================
function setupTextMode() {
    if (!checkTextBtn || !textInput || !textResult) return;

    checkTextBtn.addEventListener('click', checkTextForScam);

    // Also trigger on Enter key (Ctrl+Enter for multiline)
    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            checkTextForScam();
        }
    });
}

async function checkTextForScam() {
    const text = textInput.value.trim();

    if (!text) {
        showTextResult('warning', 'กรุณาพิมพ์ข้อความที่ต้องการตรวจสอบ');
        return;
    }

    // Show loading state
    checkTextBtn.disabled = true;
    checkTextBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบ...';
    showTextResult('loading', 'กำลังวิเคราะห์ข้อความ...');

    try {
        const response = await fetch('/api/check-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        });

        const data = await response.json();

        if (data.error) {
            showTextResult('error', `Error: ${data.error}`);
        } else {
            displayTextResult(data);
        }
    } catch (error) {
        console.error('Text check error:', error);
        showTextResult('error', `เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
        checkTextBtn.disabled = false;
        checkTextBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> วิเคราะห์ข้อความ';
    }
}

function showTextResult(type, message) {
    const iconMap = {
        'loading': 'fa-spinner fa-spin',
        'warning': 'fa-exclamation-triangle',
        'error': 'fa-times-circle',
        'success': 'fa-check-circle'
    };

    textResult.innerHTML = `
        <div class="text-result-placeholder ${type}">
            <i class="fa-solid ${iconMap[type] || 'fa-info-circle'}"></i>
            <p>${message}</p>
        </div>
    `;
}

function displayTextResult(data) {
    const label = data.label || 'SAFE';
    const isScam = label === 'SCAM';
    const isWait = label === 'WAIT';
    const confidence = Math.round((data.confidence || 0.5) * 100);
    const statusClass = label.toLowerCase();

    let badgeText = 'SAFE';
    let badgeIcon = 'fa-shield-check';

    if (isScam) {
        badgeText = '🚨 SCAM DETECTED';
        badgeIcon = 'fa-triangle-exclamation';
    } else if (isWait) {
        badgeText = '⚠️ SUSPICIOUS (Need more context)';
        badgeIcon = 'fa-circle-question';
    }

    let reasonHTML = '';
    if (data.reason) {
        reasonHTML = `
            <div class="result-reason">
                <strong>🤖 SLM Analysis:</strong><br>
                ${data.reason}
            </div>
        `;
    }

    textResult.innerHTML = `
        <div class="text-result-content ${statusClass}">
            <div class="result-badge ${statusClass}">
                <i class="fa-solid ${badgeIcon}"></i>
                <span>${badgeText}</span>
            </div>
            <div class="result-confidence">
                <div class="confidence-bar">
                    <div class="confidence-fill ${statusClass}" style="width: ${confidence}%"></div>
                </div>
                <span class="confidence-text">ความมั่นใจ: ${confidence}%</span>
            </div>
            ${reasonHTML}
            <div class="result-text-preview">
                <strong>📝 ข้อความ:</strong> "${data.text}"
            </div>
        </div>
    `;
}
