@echo off
title Codebase Memory - Cloudflare Public Tunnel
echo ==================================================
echo   Starting Cloudflare Public Tunnel for Codebase Memory
echo ==================================================
echo.
echo Forwarding http://localhost:5173 to public internet...
echo Look for the URL ending with .trycloudflare.com below:
echo.

"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:5173
pause
