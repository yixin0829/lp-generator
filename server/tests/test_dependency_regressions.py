"""Exercise integration boundaries affected by dependency security upgrades."""

import json
import os
import subprocess
import sys
import textwrap
from pathlib import Path

import httpx
import pytest
from openai import AsyncOpenAI

from app.services.learning_path_service import LearningPathGraphOutput


@pytest.mark.parametrize(
    "scenario",
    [
        """
        assert client.get('/v1/stats').status_code == 401
        assert client.get('/v1/stats', headers={'X-API-Key': 'wrong'}).status_code == 401
        response = client.get('/v1/stats', headers={'X-API-Key': 'synthetic-backend-key'})
        assert response.status_code == 200
        assert isinstance(response.json()['learning_paths_generated'], int)
        assert client.get('/health').status_code == 200
        """,
        """
        headers = {'Origin': 'https://allowed.example',
                   'Access-Control-Request-Method': 'GET',
                   'Access-Control-Request-Headers': 'X-API-Key'}
        response = client.options('/v1/stats', headers=headers)
        assert response.status_code == 200
        assert response.headers['access-control-allow-origin'] == 'https://allowed.example'
        headers['Origin'] = 'https://untrusted.example'
        response = client.options('/v1/stats', headers=headers)
        assert response.status_code == 400
        assert 'access-control-allow-origin' not in response.headers
        """,
        """
        headers = {'X-API-Key': 'synthetic-backend-key'}
        assert client.get('/v1/stats', headers=headers).status_code == 200
        assert client.get('/v1/stats', headers=headers).status_code == 200
        response = client.get('/v1/stats', headers=headers)
        assert response.status_code == 429
        assert 'Rate limit exceeded' in response.json()['error']
        """,
    ],
    ids=["api-key", "cors", "rate-limit"],
)
def test_production_middleware(scenario):
    # A fresh process exercises import-time production wiring without leaking
    # limiter/configuration state into the rest of the suite. Never load .env.
    env = {
        key: value
        for key, value in os.environ.items()
        if key.upper() in {"PATH", "SYSTEMROOT", "TEMP", "TMP", "WINDIR"}
    }
    env.update(
        APP_ENV="production",
        OPENAI_API_KEY="synthetic-openai-key",
        API_KEY="synthetic-backend-key",
        REQUIRE_API_KEY="true",
        RATE_LIMIT_ENABLED="true",
        STATS_RATE_LIMIT="2/minute",
        CORS_ORIGINS="https://allowed.example,https://second.example",
        COUNTER_BACKEND="noop",
        CACHE_BACKEND="noop",
        FEEDBACK_BACKEND="noop",
        SHARE_BACKEND="noop",
    )
    setup = "from fastapi.testclient import TestClient\nfrom app.main import app\n"
    script = (
        setup
        + "with TestClient(app) as client:\n"
        + textwrap.indent(textwrap.dedent(scenario), "    ")
    )
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=Path(__file__).resolve().parents[1],
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.asyncio
async def test_openai_structured_output_over_mock_http():
    requests = []

    def respond(request):
        requests.append(request)
        assert request.url.host == "api.openai.com"
        assert request.url.path == "/v1/responses"
        body = json.loads(request.content)
        assert body["text"]["format"]["type"] == "json_schema"
        return httpx.Response(
            200,
            json={
                "id": "resp_synthetic",
                "object": "response",
                "created_at": 0,
                "status": "completed",
                "model": "synthetic-model",
                "output": [
                    {
                        "id": "msg_synthetic",
                        "type": "message",
                        "role": "assistant",
                        "status": "completed",
                        "content": [
                            {
                                "type": "output_text",
                                "text": '{"nodes": [], "edges": []}',
                                "annotations": [],
                            }
                        ],
                    }
                ],
            },
        )

    async with AsyncOpenAI(
        api_key="synthetic-openai-key",
        base_url="https://api.openai.com/v1",
        max_retries=0,
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(respond)),
    ) as sdk:
        response = await sdk.responses.parse(
            model="synthetic-model", input="Synthetic test", text_format=LearningPathGraphOutput
        )
    assert response.output_parsed == LearningPathGraphOutput(nodes=[], edges=[])
    assert len(requests) == 1
    # HTTPX normalizes IDNs before AnyIO receives them, matching the advisory workaround.
    assert httpx.URL("https://faß.example").raw_host == b"xn--fa-hia.example"


def test_google_auth_rsa_with_cryptography():
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from google.auth.crypt import RSASigner, RSAVerifier

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    public = key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    signature = RSASigner.from_string(private).sign(b"synthetic-payload")
    verifier = RSAVerifier.from_string(public)
    assert verifier.verify(b"synthetic-payload", signature)
    assert not verifier.verify(b"modified-payload", signature)
