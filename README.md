# Scam Guard Demo (Merged)

โปรเจคนี้รวม Backend จาก `scam_demo_web` (FastAPI + AI Pipeline) กับ Frontend Design จาก `scam_detector_demo copy` (Dark Theme UI)

## 📋 Prerequisites

- Python 3.9+
- GPU with CUDA support (สำหรับ Production mode)
- [Ollama](https://ollama.ai/) (สำหรับ LLM)

## 🏗️ โครงสร้างโปรเจค

```
merge/
├── app/
│   ├── __init__.py
│   ├── config.py          # Configuration settings
│   ├── models.py           # AI Models loader
│   ├── agent_graph.py      # LangGraph Agent
│   ├── pipeline.py         # Main AI Pipeline
│   └── main.py             # FastAPI server
├── static/
│   ├── audio/              # ใส่ไฟล์เสียงที่นี่
│   ├── css/
│   │   └── style.css       # Dark theme styling
│   └── js/
│       └── script.js       # WebSocket + UI logic
├── templates/
│   └── index.html          # Main HTML page
├── requirements.txt
├── run_demo.bat
└── README.md
```

## 🚀 วิธีใช้งาน

### 1. ติดตั้ง Dependencies
```bash
pip install -r requirements.txt
```

### 2. ตั้งค่า Environment Variables
```bash
# สร้างไฟล์ .env จาก template
cp .env.example .env

# แก้ไข .env และใส่ค่าที่ถูกต้อง
# - HF_TOKEN: Hugging Face token ของคุณ
# - CALLER_IDENTIFIER_PATH: path ไปยังโมเดล caller identifier
# - SCAM_DETECTOR_PATH: path ไปยังโมเดล scam detector
```

### 3. เตรียมไฟล์เสียง
- ใส่ไฟล์ `scam_cyberpolice.wav` ใน folder `static/audio/`

### 4. ตั้งค่า Config
ตั้งค่าผ่าน environment variables หรือแก้ไข `app/config.py`:
- `USE_MOCK_AI=true` สำหรับ Demo Mode (ไม่ต้องโหลดโมเดลจริง)
- `USE_MOCK_AI=false` สำหรับ Production (ต้องมี GPU และโมเดล)

### 5. รันเซิร์ฟเวอร์
```bash
# Windows
run_demo.bat

# หรือ
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. เปิดเว็บ
เปิด browser ไปที่ `http://localhost:8000`

## ✨ Features

- **Dark Theme UI** - ดีไซน์สวยงาม ดูง่าย
- **Real-time WebSocket** - ประมวลผลแบบ Background
- **Live Transcription** - แสดงผลซิงค์กับเสียง
- **Scam Alerts** - แจ้งเตือนแบบ Toast + Panel
- **Architecture Tab** - แสดง System Diagram
- **Info Cards** - แสดงสถิติการวิเคราะห์

## 🔧 AI Models ที่ใช้

1. **Pyannote** - Speaker Diarization
2. **Whisper Thai** - Speech-to-Text
3. **WangchanBERTa** - Caller Identification
4. **Scam BERT** - Scam Detection
5. **Qwen LLM** - Explanation Generator

## 📝 Notes

- ต้องมี **GPU** สำหรับโหลดโมเดลจริง
- ต้องรัน **Ollama** สำหรับ Qwen LLM
- Mock Mode ใช้ข้อมูลจำลองสำหรับ Demo
