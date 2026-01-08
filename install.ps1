# PowerShell script for installing dependencies

Write-Host "📦 Installing Social Media Automation dependencies..." -ForegroundColor Cyan

# Backend
Write-Host "`n🐍 Installing Python dependencies..." -ForegroundColor Green
cd backend
pip install -r requirements.txt

if (-not (Test-Path ".env")) {
    Write-Host "`n⚙️ Creating .env file..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "❗ Don't forget to add your OPENAI_API_KEY in backend\.env" -ForegroundColor Red
}

cd ..

# Frontend
Write-Host "`n📱 Installing Node.js dependencies..." -ForegroundColor Blue
cd frontend
npm install
cd ..

Write-Host "`n✅ Installation complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Add OPENAI_API_KEY to backend\.env" -ForegroundColor Gray
Write-Host "2. Run: .\start.ps1" -ForegroundColor Gray

