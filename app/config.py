import os
from dotenv import load_dotenv

load_dotenv()

DEVICE = os.getenv("DEVICE", "cuda")

# Run in pitch-only mode (skip AI model loading for fast startup)
PITCH_ONLY = os.getenv("PITCH_ONLY", "false").lower() == "true"

SAMPLE_RATE = 16000

HF_TOKEN = os.getenv("HF_TOKEN", "")

MODEL_PATHS = {
    "CALLER_IDENTIFIER": os.getenv("CALLER_IDENTIFIER_PATH", r"D:\NonUni\KBTG_CyberSec\CLS\wangchan_finetuned_model2_freeze2\checkpoint-350"),
    "SCAM_DETECTOR": os.getenv("SCAM_DETECTOR_PATH", r"D:\NonUni\KBTG_CyberSec\ANL\scam_detector_model -1930_best"),
}

AGENT_CONFIG = {
    "SLIDING_WINDOW_SIZE": 5,
    "SUSPICIOUS_THRESHOLD": 0.5,
    "MAX_SUSPICIOUS_KEEP": 5,
    "OLLAMA_MODEL": "qwen3:1.7b",
    "OLLAMA_BASE_URL": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
}
