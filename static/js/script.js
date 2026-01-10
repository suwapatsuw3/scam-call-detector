/**
 * Scam Guard Demo - Main JavaScript
 * Combines WebSocket backend (from scam_demo_web) with fancy UI (from scam_detector_demo)
 */

// DOM Elements
const audio = document.getElementById('audio-source');
const playBtn = document.getElementById('play-btn');
const seekBar = document.getElementById('seek-bar');
const currentTimeSpan = document.getElementById('current-time');
const totalTimeSpan = document.getElementById('total-time');
const transcriptionBox = document.getElementById('transcription-box');
const connStatus = document.getElementById('connection-status');
const statusIndicator = document.getElementById('status-indicator');
const alertSection = document.getElementById('alert-section');
const alertConfidence = document.getElementById('alert-confidence');
const alertReason = document.getElementById('alert-reason');
const callerInfo = document.getElementById('caller-info');
const segmentsCount = document.getElementById('segments-count');
const scamCountEl = document.getElementById('scam-count');

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
// WebSocket Connection (Background Process)
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    connectWebSocket();
    setupAudioPlayer();
});

function connectWebSocket() {
    let protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl = `${protocol}//${window.location.host}/ws/analyze`;
    
    updateConnectionStatus('connecting', 'Connecting...');
    
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log("Background AI Processing Started...");
        updateConnectionStatus('processing', 'Processing in background...');
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.status === 'FINISHED') {
            updateConnectionStatus('connected', 'Analysis Complete');
            return;
        }

        // Store in buffer with unique ID
        data._id = transcriptBuffer.length;
        transcriptBuffer.push(data);
        
        // Unlock play button when first data arrives
        if (!isAIReady) {
            isAIReady = true;
            
            if (isUserWaiting) {
                isUserWaiting = false;
                startPlayback();
            }
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
        playBtn.innerHTML = '<span class="play-icon"><i class="fa-solid fa-play"></i></span>';
        updateStatus('safe', 'Analysis complete');
    });

    seekBar.addEventListener('input', () => {
        let time = (seekBar.value / 100) * audio.duration;
        audio.currentTime = time;
    });
}

playBtn.addEventListener('click', () => {
    if (audio.paused) {
        if (isAIReady) {
            startPlayback();
        } else {
            // AI not ready, show loading state
            isUserWaiting = true;
            playBtn.innerHTML = '<span class="play-icon"><i class="fa-solid fa-spinner fa-spin"></i></span>';
            playBtn.disabled = true;
            updateConnectionStatus('processing', 'Waiting for AI...');
        }
    } else {
        audio.pause();
        playBtn.innerHTML = '<span class="play-icon"><i class="fa-solid fa-play"></i></span>';
        playBtn.disabled = false;
        isUserWaiting = false;
    }
});

function startPlayback() {
    playBtn.disabled = false;
    playBtn.innerHTML = '<span class="play-icon"><i class="fa-solid fa-pause"></i></span>';
    audio.play();
    
    // Remove placeholder
    const placeholder = transcriptionBox.querySelector('.transcription-placeholder');
    if (placeholder) placeholder.remove();
    
    updateStatus('safe', 'Analyzing audio...');
}

// ==========================================
// Transcription Sync
// ==========================================
function syncTranscriptions(currentTime) {
    transcriptBuffer.forEach(item => {
        // Display when audio reaches the end time of each segment
        if (currentTime >= item.end && !displayedIds.has(item._id)) {
            displayedIds.add(item._id);
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
    callerInfo.textContent = `${speakerId} (CALLER)`;
    console.log('Caller identified:', speakerId);
}

function showScamAlert(item) {
    scamCount++;
    scamCountEl.textContent = scamCount;
    
    updateStatus('danger', `SCAM DETECTED! (${Math.round((item.confidence || 0.9) * 100)}%)`);
    
    // Show alert section
    alertSection.classList.remove('hidden');
    alertConfidence.textContent = `${Math.round((item.confidence || 0.9) * 100)}%`;
    alertReason.textContent = item.reason || 'พบรูปแบบการหลอกลวง';
}

function updateStatus(type, text) {
    statusIndicator.className = `status-indicator status-${type}`;
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
// Tab Navigation
// ==========================================
function setupTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding content
            contents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${targetTab}-tab`) {
                    content.classList.add('active');
                }
            });
        });
    });
}

// ==========================================
// Utilities
// ==========================================
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
