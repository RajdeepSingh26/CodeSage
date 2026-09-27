@echo off
title Codebase Memory - Launch Console
echo ==================================================
echo   CODEBASE MEMORY - HackWithHyderabad 3.0
echo   An AI Code Review Agent That Learns Your Team
echo ==================================================
echo.

echo [1/3] Activating virtual environment and starting FastAPI backend...
start "Codebase Memory - Backend" cmd /k ".\.venv\Scripts\python.exe run_backend.py"

echo [2/3] Starting Vite React frontend...
start "Codebase Memory - Frontend" cmd /k "cd frontend && npm run dev"

echo [3/3] Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

echo.
echo Opening browser to http://localhost:5173...
start http://localhost:5173

echo.
echo ==================================================
echo   System is running!
echo   Frontend: http://localhost:5173
echo   Backend API: http://127.0.0.1:8000
echo   API Docs: http://127.0.0.1:8000/docs
echo ==================================================
pause
