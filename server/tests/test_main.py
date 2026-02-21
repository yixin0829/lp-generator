"""Tests for main app endpoints."""


def test_root(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert "v1" in resp.json()["Hello"]


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["version"] == "v1"
