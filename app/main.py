from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from starlette.concurrency import run_in_threadpool, iterate_in_threadpool
from pydantic import BaseModel
import asyncio
import os

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Pydantic Models
class TextCheckRequest(BaseModel):
    text: str

# Startup: Pre-compute Diarization

@app.on_event("startup")
async def startup_event():
    from app.config import PITCH_ONLY
    
    if PITCH_ONLY:
        print("🎬 PITCH ONLY MODE - Skipping AI model loading for fast startup")
        print("📊 Pitch page available at: http://localhost:8000")
        print("⚠️  Demo page will NOT work in this mode")
        return
    
    try:
        from app.pipeline_hybrid import precompute_audio
        audio_path = "static/audio/scam_bank.wav"
        await run_in_threadpool(precompute_audio, audio_path)
    except Exception as e:
        print(f"Pre-computation failed: {e}")

@app.get("/", response_class=HTMLResponse)
async def read_pitch(request: Request):
    """Landing page for pitching and presentation"""
    return templates.TemplateResponse("pitch.html", {"request": request})

@app.get("/demo", response_class=HTMLResponse)
async def read_demo(request: Request):
    """Interactive demo page"""
    return templates.TemplateResponse("index.html", {"request": request})

# Text Check API (using pre-loaded pipeline)
@app.post("/api/check-text")
async def check_text(request: TextCheckRequest):
    """Check if text is scam using pre-loaded BERT + SLM"""
    try:
        from app.pipeline_hybrid import get_hybrid_pipeline
        
        pipeline = get_hybrid_pipeline()
        
        # Run BERT classification (use pre-loaded models)
        result = pipeline.scam_classifier(request.text)[0]
        score = result['score']
        label = result['label']
        
        # Determine status
        pred_class = "SCAM" if label in ["SCAM", "LABEL_1"] else "SAFE"
        final_status = "WAIT" if score < 0.7 else pred_class
        
        # If SCAM, get explanation from SLM
        reason = None
        if final_status == "SCAM":
            try:
                chain = pipeline.explain_prompt | pipeline.explainer_slm
                response = chain.invoke({"context": request.text})
                reason = response.content.strip()
            except Exception as e:
                print(f"SLM Error: {e}")
                reason = "ตรวจพบรูปแบบการหลอกลวง"
        
        return {
            "text": request.text,
            "label": final_status,
            "confidence": score,
            "reason": reason
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

@app.websocket("/ws/analyze")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    try:
        # Hybrid: Pre-computed Diarization + Realtime AI
        from app.pipeline_hybrid import get_hybrid_pipeline
        
        pipeline = await run_in_threadpool(get_hybrid_pipeline)
        audio_path = "static/audio/scam_bank.wav"
        
        # Wait for Client to send "start"
        await websocket.send_json({"status": "READY", "message": "AI Ready. Waiting for play..."})
        print("Pipeline ready. Waiting for client to start...")
        
        # Wait for message from client
        start_msg = await websocket.receive_json()
        if start_msg.get("action") != "start":
            print("Invalid start message")
            return
        
        print("Client pressed Play! Starting stream...")
        
        # Stream segments (start after client presses play)
        async for segment in iterate_in_threadpool(
            pipeline.run_hybrid_streaming(audio_path, simulate_realtime=True)
        ):
            await websocket.send_json(segment)
        
        await websocket.send_json({"status": "FINISHED"})
                
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Pipeline Error: {e}")
        import traceback
        traceback.print_exc()
        try:
            await websocket.send_json({
                "status": "ERROR", 
                "text": f"System Error: {str(e)}", 
                "reason": "AI Processing Failed"
            })
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass