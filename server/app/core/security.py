"""Security helpers: API key auth and rate limiting."""

import secrets

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_config

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
config = get_config()
limiter = Limiter(key_func=get_remote_address, enabled=config.rate_limit_enabled)


def require_api_key(api_key: str | None = Security(api_key_header)) -> None:
    """Enforce API key authentication when enabled in settings."""
    current_config = get_config()
    if not current_config.require_api_key:
        return

    if not api_key or not secrets.compare_digest(api_key, current_config.api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized.",
        )
