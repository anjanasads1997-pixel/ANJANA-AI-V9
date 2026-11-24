
# ANJANA AI V9.0 Architecture

## System Overview

ANJANA AI is a bilingual Sinhala and English local-first AI assistant.

## Main Components

1. Web Interface - public/
2. Backend API - src/
3. Authentication - src/auth/
4. AI Engine - src/core/
5. Local Data Storage - src/storage/
6. Android Configuration - android/
7. Model Installation - scripts/

## AI Processing

Browser Interface
       |
       v
Express API Server
       |
       v
Ollama Local AI
       |
       v
Qwen 2.5 Model

## Security

- Password hashing using scrypt.
- Secure session tokens.
- HttpOnly session cookies.
- Environment variables for configuration.
- Local data storage.

## Supported Languages

- Sinhala
- English

## Operating Modes

- Offline local AI through Ollama.
- Hybrid operation planned for future development.
