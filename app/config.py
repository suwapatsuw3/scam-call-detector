import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- System Configuration ---
DEVICE = os.getenv("DEVICE", "cuda")  # หรือ "cpu"
Use_Mock_AI = os.getenv("USE_MOCK_AI", "False").lower() == "true"  # เปลี่ยนเป็น False เมื่อพร้อมรันโมเดลจริง

# --- Audio Settings ---
SAMPLE_RATE = 16000

# --- Tokens ---
# ⚠️ ห้าม hardcode token! ใช้ environment variable แทน
HF_TOKEN = os.getenv("HF_TOKEN", "")

# --- Model Paths (แก้ Path ให้ตรงกับเครื่องคุณ) ---
# แนะนำให้ย้ายไฟล์โมเดลมาอยู่ใน project หรือชี้ Path ให้ถูก
MODEL_PATHS = {
    "CALLER_IDENTIFIER": os.getenv("CALLER_IDENTIFIER_PATH", r"models/caller_identifier"),
    "SCAM_DETECTOR": os.getenv("SCAM_DETECTOR_PATH", r"models/scam_detector"),
}

# --- Agent Config ---
AGENT_CONFIG = {
    "SLIDING_WINDOW_SIZE": 5,
    "SUSPICIOUS_THRESHOLD": 0.5,
    "MAX_SUSPICIOUS_KEEP": 5,
    "OLLAMA_MODEL": "qwen3:1.7b"
}
