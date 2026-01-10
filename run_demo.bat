@echo off
echo ========================================
echo   Starting Scam Guard Demo Server
echo ========================================
echo.

REM Activate conda environment if needed
REM call conda activate your_env_name

echo Starting FastAPI server on http://localhost:8000
echo Press Ctrl+C to stop the server
echo.

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause
