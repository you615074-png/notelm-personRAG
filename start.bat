@echo off
echo ============================================
echo  Notelm - Personal RAG Notebook
echo ============================================
echo.
echo Starting backend (FastAPI on port 8000)...
start "Notelm Backend" cmd /c "cd /d %~dp0backend && py -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
echo.
echo Starting frontend (Next.js on port 3000)...
start "Notelm Frontend" cmd /c "cd /d %~dp0frontend && cmd /c npx next dev -p 3000"
echo.
echo ============================================
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:3000
echo ============================================
echo.
echo Close this window after both are running.
pause
