import torch
import librosa
import numpy as np
from app.models import get_models
from app.agent_graph import agent_app
from app.config import SAMPLE_RATE, DEVICE

class ScamGuardPipeline:
    def __init__(self):
        self.models = get_models()
        self.reset_state()
        
    def reset_state(self):
        self.caller_id = None
        self.speaker_01_buffer = []
        self.recent_memory = []
        self.suspicious_memory = []

    def transcribe_segment(self, audio_path, start, end):
        # Extract audio chunk logic
        duration = end - start
        if duration < 0.5: return None
        
        # Load audio specific segment
        y, sr = librosa.load(audio_path, sr=SAMPLE_RATE, offset=start, duration=duration)
        
        # Generate kwargs to prevent hallucination (copied from your notebook logic)
        generate_kwargs = {
            "max_new_tokens": 128,
            "no_repeat_ngram_size": 3,
            "condition_on_prev_tokens": False,
            "logprob_threshold": -1.0,
            "compression_ratio_threshold": 1.35,
            "temperature": 0.0
        }

        # ASR Inference
        if duration < 30:
            result = self.models.asr(y, return_timestamps=False, generate_kwargs=generate_kwargs)
        else:
            result = self.models.asr(y, return_timestamps=True, chunk_length_s=30, generate_kwargs=generate_kwargs)
            
        return result["text"].strip()

    def identify_caller_role(self, text):
        inputs = self.models.caller_tokenizer(
            text, return_tensors="pt", truncation=True, max_length=416
        ).to(DEVICE)
        
        with torch.no_grad():
            outputs = self.models.caller_model(**inputs)
            
        probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
        pred_idx = torch.argmax(probs, dim=-1).item()
        role = self.models.caller_model.config.id2label[pred_idx]
        conf = probs[0][pred_idx].item()
        return role, conf

    def run_pipeline_step_by_step(self, audio_file):
        """
        Generator function that yields results segment by segment
        """
        self.reset_state()
        print(f"🎤 Processing: {audio_file}")
        
        # 1. Load Audio using Librosa (To avoid torchcodec error on Windows)
        y, sr = librosa.load(audio_file, sr=SAMPLE_RATE, mono=False)
        if y.ndim == 1: y = y[np.newaxis, :]
        audio_input = {"waveform": torch.from_numpy(y).float(), "sample_rate": sr}
        
        # 2. Run Diarization
        print("   - Running Diarization...")
        diarization_output = self.models.diarization(audio_input, num_speakers=2)
        
        # --- [FIX START] Extract Annotation from Output (Logic from Notebook Cell 4) ---
        annotation = None
        if hasattr(diarization_output, "itertracks"):
            annotation = diarization_output
        elif hasattr(diarization_output, "annotation"):
            annotation = diarization_output.annotation
        else:
            # Fallback for wrapped objects
            for attr in dir(diarization_output):
                if attr.startswith("_"): continue
                val = getattr(diarization_output, attr)
                if hasattr(val, "itertracks"):
                    annotation = val
                    break
        
        if not annotation:
            print("❌ Error: Could not find annotation in diarization output")
            return
        # --- [FIX END] ---

        # 3. Process segments
        for turn, _, speaker in annotation.itertracks(yield_label=True):
            start_t, end_t = turn.start, turn.end
            
            # ASR
            text = self.transcribe_segment(audio_file, start_t, end_t)
            if not text: continue
            
            # Prepare Payload
            result_payload = {
                "start": start_t,
                "end": end_t,
                "speaker": speaker,
                "text": text,
                "status": "SAFE",
                "role": "UNKNOWN",
                "reason": ""
            }

            # Caller Identification Logic
            speaker_formatted = speaker # SPEAKER_00, SPEAKER_01
            
            if self.caller_id is None:
                if speaker_formatted == "SPEAKER_01":
                    self.speaker_01_buffer.append(text)
                
                if len(self.speaker_01_buffer) >= 2:
                    dialogue = " ".join(self.speaker_01_buffer[:2])
                    role, conf = self.identify_caller_role(dialogue)
                    
                    if role == "CALLER":
                        self.caller_id = "SPEAKER_01"
                    elif role == "RECEIVER":
                        self.caller_id = "SPEAKER_00"
                    
                    self.speaker_01_buffer = [] 
            
            is_suspect = (self.caller_id and speaker_formatted == self.caller_id)
            result_payload["role"] = "CALLER" if is_suspect else "RECEIVER"

            # Scam Detection (Only check Suspect)
            if is_suspect:
                agent_res = agent_app.invoke({
                    "new_chunk": text,
                    "recent_messages": self.recent_memory,
                    "suspicious_history": self.suspicious_memory
                })
                
                self.recent_memory = agent_res.get("recent_messages", [])
                self.suspicious_memory = agent_res.get("suspicious_history", [])
                
                result_payload["status"] = agent_res["status"]
                if agent_res["status"] == "SCAM":
                    result_payload["reason"] = agent_res.get("reason", "Detected suspicious pattern")
            
            yield result_payload
