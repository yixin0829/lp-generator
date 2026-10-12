# lp-generator-backend
Learning Path Generator backend API.

Requires Python 3.11 or newer (the production Docker image uses Python 3.12).
The application uses `datetime.UTC`, introduced in Python 3.11; the patched
FastAPI/Starlette/AnyIO dependencies also no longer support Python 3.9.

Use `uv sync --frozen --extra dev` for development and `uv sync --frozen --no-dev`
for production. After dependency changes, regenerate the production pip export:

```bash
uv export --frozen --no-dev --no-hashes --no-emit-project --output-file requirements.txt
```

## How to Run
- Create a `.env` file in root and paste in your [OpenAI API key](https://openai.com/api/) as `OPENAI_API_KEY=...`
- Create a `venv` and `pip` install all dependencies in `requirements.txt`
- Run the BE using `uvicorn main:app --reload`
