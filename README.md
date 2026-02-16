# Learning Path Generator

## 1 Goal
Help people learn faster and more efficiently to reach their learning goal. LearnAnything's mission is to facilitate the consolidation of the world's knowledge sharing by creating a place where users can share their learning experiences and knowledge with others.

## 2 Overview
Why did we build LearnAnything? You might ask. Well, we want you to think of LearnAnything as more than just a learning path generator, but as an entry point for YOU to begin your learning journey on any topic that you could possibly imagine. Just as Mahatma Gandhi once said, "Live as if you were to die tomorrow. Learn as if you were to live forever."

## 3 How to Run
### 3.1 Local (without Docker)
- Backend
    - `cd server`
    - `uv sync`
    - Set `OPENAI_API_KEY` in your shell or `.env`
    - Optional: set `CORS_ORIGINS=http://localhost:3000` (comma-separated list supported)
    - Start API: `uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- Frontend
    - `cd client`
    - `npm install`
    - `npm run dev`
    - App runs at `http://localhost:3000`
- API base URL config
    - `client/.env.development` defaults to `BE_API_BASE_URL=http://localhost:8000`
    - Local FE+BE flow should call `http://localhost:8000/v1/lp/{term}`

### 3.2 Frontend Production Env (Vercel)
- The repo keeps `client/.env.production` as:
    - `BE_API_BASE_URL=__PROD_API_BASE_URL_PLACEHOLDER__`
- In Vercel Project Settings, set:
    - `BE_API_BASE_URL=https://<your-deployed-backend-url>`
- This variable is required for production API calls.

### 3.3 With Docker Compose
- Run from repo root: `docker compose up --build`
- Frontend served on `http://localhost:3000`
- Backend served on `http://localhost:8000`

### 3.4 Backend Deployment (Cloud Run)
- Build and deploy (example):
    - `gcloud builds submit --tag gcr.io/$GOOGLE_CLOUD_PROJECT/lp-backend ./server`
    - `gcloud run deploy lp-backend --image gcr.io/$GOOGLE_CLOUD_PROJECT/lp-backend --region <region> --platform managed --allow-unauthenticated --set-env-vars CORS_ORIGINS=https://<your-frontend-domain> --set-secrets OPENAI_API_KEY=OPENAI_API_KEY:latest`
- The container serves FastAPI with:
    - `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check endpoint:
    - `GET /health`

## 4 Resources
- [GPT model output comparison tool](https://gpttools.com/comparisontool)
- [OpenAI Best Practices for Prompt Engineering](https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-openai-api)
- [OpenAI documentation - model details](https://beta.openai.com/docs/models)
- [OpenAI example prompts and use cases](https://beta.openai.com/examples)
- [OpenAI Production Best Practice](https://beta.openai.com/docs/guides/production-best-practices)
- FE Utilities
    - [WebGradient Templates](https://webgradients.com/)
    - [ShareGPT](https://sharegpt.com/) - Design reference
- Similar ideas
    - [Similar idea: Learn from anyone](https://twitter.com/mckaywrigley/status/1284110063498522624)
    - [Roadmap.sh - open source learning groadmap project](https://roadmap.sh/frontend)
    - [Learn Anything xyz](https://learn-anything.xyz/)
    - [Learney - closest example](https://maps.joindeltaacademy.com/)
    - [Map of Reddit](https://anvaka.github.io/map-of-reddit/) by [Anvaka (graph lover)](https://github.com/anvaka)
- Miscellaneous
    - [Github Copilot code assistant](https://docs.github.com/en/copilot/quickstart)
    - [Fine tuning the model (GPT-3) - Tutorial by Weights & Biases](https://www.youtube.com/watch?v=5MNqn_7ty8A&ab_channel=Weights%26Biases) (to watch)
