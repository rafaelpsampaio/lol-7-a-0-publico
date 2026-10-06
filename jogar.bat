@echo off
cd /d "%~dp0"
echo Buildando o app...
call npm run build
if errorlevel 1 (
  echo.
  echo O build falhou. Veja o erro acima.
  pause
  exit /b 1
)
echo.
echo Subindo o servidor com tunel para fora da rede...
call npm run server -- --tunnel --nova-sala
pause
