# PowerShell script to start both servers

Write-Host "🚀 Starting Social Media Automation System..." -ForegroundColor Cyan

# Check .env
if (-not (Test-Path "backend\.env")) {
    Write-Host "⚠️ Create backend\.env file with OPENAI_API_KEY!" -ForegroundColor Yellow
    Write-Host "Example: OPENAI_API_KEY=sk-..." -ForegroundColor Gray
    exit 1
}

# Start Backend
Write-Host "`n📦 Starting Backend (FastAPI)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python main.py"

# Wait 3 seconds
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "🎨 Starting Frontend (React)..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "`n✅ System started!" -ForegroundColor Green
Write-Host "Backend: http://localhost:8000" -ForegroundColor Gray
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Gray
Write-Host "`nOpen http://localhost:3000 in your browser" -ForegroundColor Cyan

