import torch
import librosa
import numpy as np
from transformers import pipeline as hf_pipeline
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from pyannote.audio import Pipeline
from langchain_ollama import ChatOllama
from app.config import HF_TOKEN, DEVICE, MODEL_PATHS, AGENT_CONFIG

class AIModels:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AIModels, cls).__new__(cls)
            cls._instance.init_models()
        return cls._instance

    def init_models(self):
        print("Loading AI Models... (This may take a while)")
        
        # 1. Diarization
        print("   - Loading Pyannote...")
        self.diarization = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1", 
            token=HF_TOKEN
        ).to(torch.device(DEVICE))

        # 2. ASR (Whisper)
        print("   - Loading Whisper TH...")
        self.asr = hf_pipeline(
            "automatic-speech-recognition", 
            model="biodatlab/distill-whisper-th-small",
            device=0 if DEVICE == "cuda" else -1
        )
        # Thai config
        self.asr.model.config.forced_decoder_ids = self.asr.tokenizer.get_decoder_prompt_ids(
            language="th", task="transcribe"
        )

        # 3. Caller Identifier (WangchanBERTa)
        print("   - Loading Caller ID Model...")
        self.caller_tokenizer = AutoTokenizer.from_pretrained(MODEL_PATHS["CALLER_IDENTIFIER"])
        self.caller_model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATHS["CALLER_IDENTIFIER"])
        self.caller_model.to(DEVICE)
        self.caller_model.eval()

        # 4. Scam Detector
        print("   - Loading Scam Detector...")
        sd_tokenizer = AutoTokenizer.from_pretrained(MODEL_PATHS["SCAM_DETECTOR"], use_fast=False)
        self.scam_classifier = hf_pipeline(
            "text-classification",
            model=MODEL_PATHS["SCAM_DETECTOR"],
            tokenizer=sd_tokenizer,
            device=DEVICE
        )

        # 5. Explainer (Ollama)
        print("   - Connecting to Ollama...")
        self.explainer_slm = ChatOllama(
            model=AGENT_CONFIG["OLLAMA_MODEL"],
            temperature=0.3,
            base_url=AGENT_CONFIG["OLLAMA_BASE_URL"]
        )
        
        print("All Models Loaded!")

# Helper function to get instance
def get_models():
    return AIModels()
