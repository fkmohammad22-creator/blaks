# AI UNLIMITED AGENTS

Multi-provider, multi-agent AI orchestration API designed to connect to a ChatGPT Custom GPT through Actions.

> This project does not bypass ChatGPT, OpenAI, or other providers' quotas. It routes requests across providers you configure and reports usage transparently.

## Features
- Orchestrator with specialist agents: research, coding, analysis, writing, and review
- Multi-provider model routing (OpenAI-compatible chat completions APIs)
- Provider/model selection through environment variables
- API-key protected HTTP API
- Health and capabilities endpoints
- OpenAPI schema for ChatGPT Actions
- Request limits, timeouts, and safe error handling

## Requirements
- Node.js 20+
- At least one provider API key and a compatible model endpoint

## Quick start
```bash
npm install
cp .env.example .env
# Set API keys and model names in .env
npm run dev
```

API runs on `http://localhost:3000`.

## ChatGPT integration
1. Deploy this API to an HTTPS host you control.
2. Set `API_KEY` to a long random secret.
3. Update `servers[0].url` in `openapi.yaml` to your deployed HTTPS URL.
4. In GPT Builder, add an Action and import `openapi.yaml`.
5. Configure API-key authentication using the same secret.

The API must be publicly reachable by ChatGPT Actions; localhost alone is not sufficient.

## Endpoints
- `GET /health` — health check
- `GET /v1/agents` — configured agents and provider capabilities
- `POST /v1/chat` — execute a task with the orchestrator

## Environment
See `.env.example`. Provider keys are read only from server environment variables and must never be committed.

## License
MIT
