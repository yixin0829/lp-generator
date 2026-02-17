"""Application configuration from environment."""

import os
from functools import lru_cache
from pathlib import Path


def _get_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def get_cors_origins() -> list[str]:
    """Parse CORS origins from CORS_ORIGINS env (comma-separated). Defaults to * if unset."""
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if not raw:
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


def _load_local_env(app_env: str) -> None:
    """Load local .env only in non-production environments."""
    if app_env in {"local", "development", "test"}:
        dotenv_path = Path(__file__).resolve().parents[2] / ".env"
        _load_env_file_if_present(dotenv_path)


def _load_env_file_if_present(dotenv_path: Path) -> None:
    """Populate os.environ from a local .env file without overriding runtime values."""
    if not dotenv_path.exists():
        return

    for raw_line in dotenv_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if line.startswith("export "):
            line = line[len("export ") :].strip()

        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"'")
        if key:
            os.environ.setdefault(key, value)


@lru_cache
def get_config() -> "Settings":
    return Settings()


class Settings:
    """Application settings."""

    def __init__(self) -> None:
        self.app_env = os.getenv("APP_ENV", "development").strip().lower()
        _load_local_env(self.app_env)

        self.version = os.getenv("API_VERSION", "v1")
        self.cors_origins = get_cors_origins()
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-5-mini")
        self.max_topic_length = int(os.getenv("MAX_TOPIC_LENGTH", "30"))
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.counter_backend = os.getenv("COUNTER_BACKEND", "noop").strip().lower()
        self.counter_seed = int(os.getenv("COUNTER_SEED", "482"))
        self.api_key = os.getenv("API_KEY", "").strip()
        self.require_api_key = _get_bool_env(
            "REQUIRE_API_KEY", default=self.app_env == "production"
        )
        self.rate_limit_enabled = _get_bool_env(
            "RATE_LIMIT_ENABLED", default=self.app_env != "test"
        )
        self.lp_rate_limit = os.getenv("LP_RATE_LIMIT", "15/minute").strip()
        self.stats_rate_limit = os.getenv("STATS_RATE_LIMIT", "30/minute").strip()
        self.firestore_counter_collection = os.getenv(
            "FIRESTORE_COUNTER_COLLECTION", "stats"
        ).strip()
        self.firestore_counter_document = os.getenv(
            "FIRESTORE_COUNTER_DOCUMENT", "learning_paths"
        ).strip()
        self.firestore_counter_field = os.getenv(
            "FIRESTORE_COUNTER_FIELD", "generated_count"
        ).strip()
        self._validate()

    def _validate(self) -> None:
        if self.max_topic_length <= 0:
            raise ValueError("MAX_TOPIC_LENGTH must be greater than 0.")
        if self.counter_backend not in {"noop", "firestore"}:
            raise ValueError("COUNTER_BACKEND must be either 'noop' or 'firestore'.")
        if self.counter_seed < 0:
            raise ValueError("COUNTER_SEED must be zero or greater.")
        if not self.lp_rate_limit:
            raise ValueError("LP_RATE_LIMIT must not be empty.")
        if not self.stats_rate_limit:
            raise ValueError("STATS_RATE_LIMIT must not be empty.")

        # Keep tests ergonomic while still enforcing secrets for real environments.
        if self.app_env == "test" and not self.openai_api_key:
            self.openai_api_key = "test-openai-api-key"

        if not self.openai_api_key:
            raise RuntimeError(
                "Missing required secret OPENAI_API_KEY. "
                "Set it in your runtime environment. "
                "Use .env only for local development; in production use your platform secret manager."
            )

        if self.app_env == "production":
            if not self.cors_origins or "*" in self.cors_origins:
                raise RuntimeError(
                    "CORS_ORIGINS must be explicitly configured in production and cannot contain '*'."
                )

        if self.require_api_key and not self.api_key:
            raise RuntimeError(
                "Missing required API_KEY while REQUIRE_API_KEY is enabled. "
                "Set API_KEY in your runtime environment or disable REQUIRE_API_KEY."
            )
