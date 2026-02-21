"""Application configuration from environment."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _local_env_file() -> Path:
    return Path(__file__).resolve().parents[2] / ".env"


def _should_load_local_env() -> bool:
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    return app_env in {"local", "development", "test"}


@lru_cache
def get_config() -> Settings:
    env_file = _local_env_file() if _should_load_local_env() else None
    return Settings(_env_file=env_file, _env_file_encoding="utf-8")


def _patch_env_source(source):
    """Prevent pydantic-settings from JSON-decoding cors_origins so our
    field_validator can split the comma-separated string instead."""
    original = source.prepare_field_value

    def _prepare(field_name, field, value, value_is_complex):
        if isinstance(value, str) and field_name == "cors_origins":
            return value
        return original(field_name, field, value, value_is_complex)

    source.prepare_field_value = _prepare
    return source


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(extra="ignore", case_sensitive=False)

    app_env: str = Field(default="development", validation_alias="APP_ENV")
    version: str = Field(default="v1", validation_alias="API_VERSION")
    cors_origins: list[str] = Field(default_factory=lambda: ["*"], validation_alias="CORS_ORIGINS")
    openai_model: str = Field(default="gpt-5-mini", validation_alias="OPENAI_MODEL")
    max_topic_length: int = Field(default=30, validation_alias="MAX_TOPIC_LENGTH", gt=0)
    openai_api_key: str = Field(default="", validation_alias="OPENAI_API_KEY")
    counter_backend: str = Field(default="noop", validation_alias="COUNTER_BACKEND")
    api_key: str = Field(default="", validation_alias="API_KEY")
    require_api_key: bool | None = Field(default=None, validation_alias="REQUIRE_API_KEY")
    rate_limit_enabled: bool | None = Field(default=None, validation_alias="RATE_LIMIT_ENABLED")
    lp_rate_limit: str = Field(default="15/minute", validation_alias="LP_RATE_LIMIT")
    stats_rate_limit: str = Field(default="30/minute", validation_alias="STATS_RATE_LIMIT")
    firestore_counter_collection: str = Field(
        default="stats", validation_alias="FIRESTORE_COUNTER_COLLECTION"
    )
    firestore_counter_document: str = Field(
        default="learning_paths", validation_alias="FIRESTORE_COUNTER_DOCUMENT"
    )
    firestore_counter_field: str = Field(
        default="generated_count", validation_alias="FIRESTORE_COUNTER_FIELD"
    )

    @classmethod
    def settings_customise_sources(cls, settings_cls, init_settings, env_settings,
                                   dotenv_settings, file_secret_settings):
        return (init_settings, _patch_env_source(env_settings),
                _patch_env_source(dotenv_settings), file_secret_settings)

    @field_validator("app_env", mode="before")
    @classmethod
    def _normalize_app_env(cls, value: Any) -> str:
        if value is None:
            return "development"
        return str(value).strip().lower()

    @field_validator("counter_backend", mode="before")
    @classmethod
    def _normalize_counter_backend(cls, value: Any) -> str:
        if value is None:
            return "noop"
        return str(value).strip().lower()

    @field_validator(
        "version",
        "openai_model",
        "openai_api_key",
        "api_key",
        "lp_rate_limit",
        "stats_rate_limit",
        "firestore_counter_collection",
        "firestore_counter_document",
        "firestore_counter_field",
        mode="before",
    )
    @classmethod
    def _normalize_str(cls, value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: Any) -> list[str]:
        if value is None:
            return ["*"]

        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return ["*"]
            return [origin.strip() for origin in raw.split(",") if origin.strip()]

        if isinstance(value, list):
            parsed = [str(origin).strip() for origin in value if str(origin).strip()]
            return parsed or ["*"]

        raise ValueError("CORS_ORIGINS must be a comma-separated string or list of strings.")

    @model_validator(mode="after")
    def _validate_settings(self) -> Settings:
        if self.counter_backend not in {"noop", "firestore"}:
            raise ValueError("COUNTER_BACKEND must be either 'noop' or 'firestore'.")
        if not self.lp_rate_limit:
            raise ValueError("LP_RATE_LIMIT must not be empty.")
        if not self.stats_rate_limit:
            raise ValueError("STATS_RATE_LIMIT must not be empty.")

        if self.require_api_key is None:
            self.require_api_key = self.app_env == "production"
        if self.rate_limit_enabled is None:
            self.rate_limit_enabled = self.app_env != "test"

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

        return self
