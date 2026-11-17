
@echo off
echo ==================================
echo ANJANA AI V9.0 - MODEL INSTALLER
echo ==================================

where ollama >nul 2>nul

if errorlevel 1 (
    echo Ollama is not installed.
    echo Install from https://ollama.com/download
    pause
    exit /b 1
)

echo Installing Qwen 2.5 1.5B...
ollama pull qwen2.5:1.5b

if errorlevel 1 (
    echo Model installation failed.
    pause
    exit /b 1
)

echo.
echo Model installation completed!
ollama list
pause
