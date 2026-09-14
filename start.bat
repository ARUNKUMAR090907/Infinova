@echo off
REM ============================================================
REM  INFINOVA — One-Click Launcher (Windows Batch)
REM  Smart India Hackathon 2026 · PS-26143
REM ============================================================
title INFINOVA

echo.
echo  ███╗   ███╗ █████╗ ██████╗ ██╗███╗   ██╗███████╗ ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗
echo  ████╗ ████║██╔══██╗██╔══██╗██║████╗  ██║██╔════╝██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗
echo  ██╔████╔██║███████║██████╔╝██║██╔██╗ ██║█████╗  ██║  ███╗██║   ██║███████║██████╔╝██║  ██║
echo  ██║╚██╔╝██║██╔══██║██╔══██╗██║██║╚██╗██║██╔══╝  ██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║
echo  ██║ ╚═╝ ██║██║  ██║██║  ██║██║██║ ╚████║███████╗╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
echo  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝
echo.
echo  Smart India Hackathon 2026 -- PS-26143
echo  Satellite Oil Spill Detection + AIS Attribution + Drift Modelling
echo.

REM ---- Backend (FastAPI + Uvicorn) ----------------------------
echo [1/2] Starting FastAPI backend on http://127.0.0.1:8000 ...
start "INFINOVABackend" cmd /k ".\.venv\Scripts\uvicorn.exe backend.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

REM ---- Frontend (Vite dev server) -----------------------------
echo [2/2] Starting Vite frontend on http://localhost:5173 ...
start "INFINOVAFrontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo  ✓ Both servers launching in separate windows.
echo  ✓ Open  http://localhost:5173  in your browser.
echo  ✓ API docs at  http://127.0.0.1:8000/docs
echo.
pause
