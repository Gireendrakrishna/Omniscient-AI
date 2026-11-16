@echo off
echo Starting OMNISCIENT AI...
start "OMNISCIENT AI Backend" cmd /k "cd /d %~dp0 && .venv\Scripts\uvicorn.exe main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload"
start "OMNISCIENT AI Frontend" cmd /k "cd /d %~dp0 && npm run dev --prefix frontend"
echo.
echo OMNISCIENT AI is launching!
echo Frontend UI:  http://localhost:5173
echo Backend Docs: http://127.0.0.1:8000/docs
