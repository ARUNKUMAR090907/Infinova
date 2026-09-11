# ============================================================
#  INFINOVA — One-Click Launcher (PowerShell)
#  Smart India Hackathon 2026 · PS-26143
# ============================================================

$Banner = @"

 ███╗   ███╗ █████╗ ██████╗ ██╗███╗   ██╗███████╗ ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗
 ████╗ ████║██╔══██╗██╔══██╗██║████╗  ██║██╔════╝██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗
 ██╔████╔██║███████║██████╔╝██║██╔██╗ ██║█████╗  ██║  ███╗██║   ██║███████║██████╔╝██║  ██║
 ██║╚██╔╝██║██╔══██║██╔══██╗██║██║╚██╗██║██╔══╝  ██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║
 ██║ ╚═╝ ██║██║  ██║██║  ██║██║██║ ╚████║███████╗╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
 ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝

 Smart India Hackathon 2026 -- PS-26143
 Satellite Oil Spill Detection + AIS Attribution + Drift Modelling
"@

Write-Host $Banner -ForegroundColor Cyan

$Root = $PSScriptRoot

# ---- Backend (FastAPI + Uvicorn) ----------------------------
Write-Host "[1/2] Starting FastAPI backend on http://127.0.0.1:8000 ..." -ForegroundColor Green
$BackendArgs = "-NoExit -Command `"Set-Location '$Root'; .\.venv\Scripts\uvicorn.exe backend.main:app --host 127.0.0.1 --port 8000 --reload`""
Start-Process powershell -ArgumentList $BackendArgs -WindowStyle Normal

Start-Sleep -Seconds 2

# ---- Frontend (Vite dev server) -----------------------------
Write-Host "[2/2] Starting Vite frontend on http://localhost:5173 ..." -ForegroundColor Green
$FrontendArgs = "-NoExit -Command `"Set-Location '$Root\frontend'; npm run dev`""
Start-Process powershell -ArgumentList $FrontendArgs -WindowStyle Normal

Write-Host ""
Write-Host " ✓ Both servers launching in separate windows." -ForegroundColor Yellow
Write-Host " ✓ Open  http://localhost:5173  in your browser." -ForegroundColor Yellow
Write-Host " ✓ API docs at  http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host ""
