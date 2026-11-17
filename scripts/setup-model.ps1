
$ErrorActionPreference = "Stop"

$model = "qwen2.5:1.5b"

Write-Host "ANJANA AI - Installing local AI model"

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
    Write-Host "Ollama is not installed."
    Write-Host "Install from https://ollama.com/download"
    exit 1
}

ollama pull $model

if ($LASTEXITCODE -ne 0) {
    throw "Model download failed."
}

Write-Host "Model installation completed."
ollama list
