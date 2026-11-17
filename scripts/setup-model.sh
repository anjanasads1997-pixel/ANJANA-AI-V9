
#!/usr/bin/env sh
set -eu

MODEL="qwen2.5:1.5b"

echo "ANJANA AI V9.0 - Local Model Setup"

if ! command -v ollama >/dev/null 2>&1; then
    echo "Ollama is not installed."
    echo "Install from https://ollama.com/download"
    exit 1
fi

echo "Downloading model: $MODEL"
ollama pull "$MODEL"

echo "Installation completed."
ollama list
