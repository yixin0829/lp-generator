# Cloud Run - Python 3.12 slim, no hardcoded secrets
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .
ENV PATH="/app/.venv/bin:$PATH"

RUN useradd --create-home appuser \
    && chown -R appuser:appuser /app
USER appuser

# PORT is set by Cloud Run; default 8080 for local runs
EXPOSE 8080
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
