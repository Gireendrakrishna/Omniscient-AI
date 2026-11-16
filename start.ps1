# OMNISCIENT AI — One-Command Launcher (PowerShell)
Write-Host "Starting OMNISCIENT AI Backend (8000) and Frontend (5173)..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot'; .\.venv\Scripts\uvicorn.exe main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot'; npm run dev --prefix frontend"

Write-Host "OMNISCIENT AI is running!" -ForegroundColor Green
Write-Host "Frontend UI:  http://localhost:5173" -ForegroundColor Yellow
Write-Host "Backend Docs: http://127.0.0.1:8000/docs" -ForegroundColor Yellow
