"""Pytest fixtures."""

import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("OPENAI_API_KEY", "test-openai-api-key")

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
