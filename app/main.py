from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from starlette.concurrency import run_in_threadpool, iterate_in_threadpool # <--- เพิ่มตัวนี้
import asyncio
import json
import os
from app.config import Use_Mock_AI

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.websocket("/ws/analyze")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # 1. เริ่มรันทันทีโดยไม่ต้องรอคำสั่ง (Background Process)
    try:
        if Use_Mock_AI:
            await run_mock_pipeline(websocket)
        else:
            try:
                # Import ตรงนี้
                from app.pipeline import ScamGuardPipeline
                
                # --- จุดแก้ที่ 1: โหลด Pipeline ใน Thread แยก (กัน Blocking ตอนโหลดโมเดล) ---
                # ถ้า ScamGuardPipeline() ใช้เวลาสร้างนาน ต้องใช้ run_in_threadpool
                pipeline = await run_in_threadpool(ScamGuardPipeline)
                
                audio_path = "static/audio/scam_bank.wav" 
                
                # --- จุดแก้ที่ 2: รัน Loop ใน Thread แยก (กัน Blocking ตอนประมวลผล) ---
                # ใช้ iterate_in_threadpool เพื่อแปลง Sync Generator ให้เป็น Async Iterator
                async for segment in iterate_in_threadpool(pipeline.run_pipeline_step_by_step(audio_path)):
                    await websocket.send_json(segment)
                    # ไม่จำเป็นต้องใช้ asyncio.sleep(0.01) แล้ว เพราะ iterate_in_threadpool คืน control ให้ loop อัตโนมัติ
                    
                # ส่งสัญญาณจบ
                await websocket.send_json({"status": "FINISHED"})
                    
            except Exception as e:
                print(f"Pipeline Error: {e}")
                # เช็คสถานะก่อนส่ง (เผื่อ connection ปิดไปแล้ว)
                try:
                    await websocket.send_json({
                        "status": "SCAM", 
                        "text": f"System Error: {str(e)}", 
                        "reason": "AI Processing Failed"
                    })
                except RuntimeError:
                    pass # ถ้าส่งไม่ได้ (Connection ปิด) ก็ปล่อยผ่าน
                
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Unexpected Error: {e}")
    finally:
        try:
            await websocket.close()
        except:
            pass

async def run_mock_pipeline(websocket):
    # Mock data ที่ทยอยส่งมา
    mock_data = [
        {"start": 0.5, "end": 3.2, "speaker": "SPEAKER_01", "text": "สวัสดีครับ ผมโทรมาจากธนาคารกสิกรไทยครับ", "status": "SAFE", "role": "CALLER", "reason": "", "confidence": 0.45},
        {"start": 3.5, "end": 5.8, "speaker": "SPEAKER_00", "text": "ครับ มีอะไรครับ", "status": "SAFE", "role": "RECEIVER", "reason": "", "confidence": 0},
        {"start": 6.0, "end": 12.5, "speaker": "SPEAKER_01", "text": "ผมโทรมาแจ้งว่า บัญชีของคุณมีความผิดปกติครับ มีการทำธุรกรรมที่น่าสงสัย", "status": "WAIT", "role": "CALLER", "reason": "", "confidence": 0.58},
        {"start": 12.8, "end": 14.5, "speaker": "SPEAKER_00", "text": "อ้าว จริงเหรอครับ", "status": "SAFE", "role": "RECEIVER", "reason": "", "confidence": 0},
        {"start": 14.8, "end": 22.0, "speaker": "SPEAKER_01", "text": "ใช่ครับ เราตรวจพบว่ามีคนพยายามเข้าถึงบัญชีของคุณ ต้องทำการยืนยันตัวตนด่วนครับ", "status": "WAIT", "role": "CALLER", "reason": "", "confidence": 0.65},
        {"start": 22.5, "end": 25.0, "speaker": "SPEAKER_00", "text": "ต้องทำยังไงครับ", "status": "SAFE", "role": "RECEIVER", "reason": "", "confidence": 0},
        {"start": 25.5, "end": 35.0, "speaker": "SPEAKER_01", "text": "คุณต้องบอกเลขบัตรประชาชน 13 หลัก และรหัส OTP ที่จะส่งไปให้ทาง SMS ครับ เพื่อยืนยันว่าเป็นเจ้าของบัญชีจริง", "status": "SCAM", "role": "CALLER", "reason": "มีการขอข้อมูลส่วนตัวที่สำคัญ (เลขบัตรประชาชน, OTP) ซึ่งธนาคารจริงจะไม่มีการขอข้อมูลเหล่านี้ทางโทรศัพท์", "confidence": 0.92},
        {"start": 35.5, "end": 38.0, "speaker": "SPEAKER_00", "text": "เอ่อ... รอแป๊บนะครับ", "status": "SAFE", "role": "RECEIVER", "reason": "", "confidence": 0},
        {"start": 38.5, "end": 48.0, "speaker": "SPEAKER_01", "text": "ต้องรีบหน่อยนะครับ เพราะถ้าไม่ทำภายใน 5 นาที บัญชีจะถูกระงับถาวร และเงินในบัญชีจะหายไปทั้งหมด", "status": "SCAM", "role": "CALLER", "reason": "สร้างความเร่งด่วนและความกลัว ข่มขู่ว่าเงินจะหาย ซึ่งเป็นกลยุทธ์หลอกลวงทั่วไป", "confidence": 0.95},
        {"start": 48.5, "end": 52.0, "speaker": "SPEAKER_00", "text": "ผมต้องโทรไปถามธนาคารก่อนได้ไหมครับ", "status": "SAFE", "role": "RECEIVER", "reason": "", "confidence": 0},
        {"start": 52.5, "end": 62.0, "speaker": "SPEAKER_01", "text": "ไม่ได้ครับ ตอนนี้เป็นกรณีฉุกเฉิน ถ้าคุณวางสายไปโทรหาธนาคาร บัญชีจะถูกล็อคทันที คุณต้องให้ข้อมูลกับผมตอนนี้เท่านั้น", "status": "SCAM", "role": "CALLER", "reason": "พยายามกีดกันไม่ให้ติดต่อธนาคารโดยตรง และกดดันให้ให้ข้อมูลทันที ซึ่งเป็นสัญญาณชัดเจนของมิจฉาชีพ", "confidence": 0.98},
        {"start": 62.5, "end": 68.0, "speaker": "SPEAKER_01", "text": "นอกจากนี้ คุณต้องโอนเงินไปยังบัญชีปลอดภัยที่ธนาคารจัดเตรียมไว้ให้ เพื่อป้องกันเงินถูกขโมย", "status": "SCAM", "role": "CALLER", "reason": "ขอให้โอนเงินไปบัญชีอื่น ซึ่งเป็นกลอุบายหลอกลวงที่พบบ่อยที่สุด ธนาคารจริงไม่มีนโยบายนี้", "confidence": 0.99},
    ]
    for item in mock_data:
        await asyncio.sleep(2) # จำลองเวลาประมวลผล
        await websocket.send_json(item)
    await websocket.send_json({"status": "FINISHED"})