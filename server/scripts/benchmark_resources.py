"""Reproducible resource benchmark. --live requires a process-only OpenAI key.

No Firestore/config writes, URL fetches, provider signup, or hidden retries.
Costs are conservative calculated upper bounds, not invoice verification.
"""

import argparse
import asyncio
import json
import os
import random
import statistics
import time
from pathlib import Path
from types import SimpleNamespace

from openai import AsyncOpenAI

from app.schemas.resources import ResourceRequest
from app.services.resource_service import CATALOGUE_VERSION, ResourceService, catalogue_resources

MANIFEST = [
    ("Python", "Loops"),
    ("JavaScript", "Closures"),
    ("React", "State"),
    ("SQL", "Joins"),
    ("Guitar", "Chords"),
    ("Photography", "Exposure"),
    ("Pottery", "Glazing"),
    ("Beekeeping", "Hive inspection"),
    ("Question asking", "Clarifying assumptions"),
    ("Turkish", "Vowel harmony"),
    ("Hydrogeology", "Aquifer tests"),
    ("Cooking", "Emulsification"),
]


class Meter:
    def __init__(self, client, cap, ledger=None):
        self.client, self.cap = client, min(cap, 5.0)
        self.spent = 0.0
        self.calls = []
        self.ledger = ledger
        self.lock = None
        if ledger:
            ledger.parent.mkdir(parents=True, exist_ok=True)
            self.lock = ledger.with_suffix(ledger.suffix + ".lock")
            # Fail closed for concurrent runs or a stale lock after interruption.
            fd = os.open(self.lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            os.close(fd)
            try:
                if ledger.exists():
                    previous = json.loads(ledger.read_text(encoding="utf-8"))
                    self.spent = float(previous["spent_upper_bound_usd"])
                    self.cap = min(self.cap, float(previous["cap_usd"]))
                    if not 0 <= self.spent or not 0 < self.cap <= 5:
                        raise ValueError("Invalid budget ledger")
            except BaseException:
                self.close()
                raise
        self.prior_spend = self.spent
        self.responses = SimpleNamespace(create=self.create)

    def persist(self):
        if self.ledger:
            temporary = self.ledger.with_suffix(self.ledger.suffix + ".tmp")
            temporary.write_text(
                json.dumps(
                    {"version": 1, "cap_usd": self.cap, "spent_upper_bound_usd": self.spent},
                    indent=2,
                ),
                encoding="utf-8",
            )
            os.replace(temporary, self.ledger)

    def close(self):
        if self.lock:
            self.lock.unlink(missing_ok=True)
            self.lock = None

    async def create(self, **kwargs):
        reservation = 0.10
        # Reserve before calling, including failed calls with unknown usage.
        if self.spent + reservation > self.cap - 0.20:
            raise RuntimeError("Budget reservation limit reached")
        self.spent += reservation
        self.persist()
        started = time.perf_counter()
        try:
            response = await self.client.responses.create(**kwargs)
        except Exception as exc:
            self.calls.append(
                {
                    "status": "failed_unknown_usage",
                    "reserved_usd": reservation,
                    "latency_ms": (time.perf_counter() - started) * 1000,
                    "error_type": type(exc).__name__,
                }
            )
            raise
        data = response.model_dump()
        usage = data.get("usage") or {}
        input_tokens = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)
        searches = sum(item.get("type") == "web_search_call" for item in data.get("output", []))
        upper = input_tokens * 0.40 / 1e6 + output_tokens * 1.60 / 1e6 + searches * 0.0132
        # Keep reservation if metering is absent. Search content may already be
        # included in usage: adding its fixed fee here intentionally overcounts.
        charged = upper if usage and searches else reservation
        self.spent += charged - reservation
        self.persist()
        self.calls.append(
            {
                "status": "success",
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "search_calls": searches,
                "calculated_upper_bound_usd": charged,
                "latency_ms": (time.perf_counter() - started) * 1000,
            }
        )
        return response


async def run(args):
    key = os.environ.get("OPENAI_API_KEY") if args.live else None
    if args.live and not key:
        raise SystemExit(
            "Live benchmark blocked: securely set OPENAI_API_KEY for this process. No API calls made."
        )
    client = AsyncOpenAI(api_key=key, max_retries=0, timeout=18) if key else None
    try:
        meter = Meter(client, args.cap, args.ledger.resolve()) if client else None
    except Exception:
        if client:
            await client.close()
        raise SystemExit(
            "Budget ledger unavailable or locked; no API calls made. Preserve the ledger and resolve the lock before retrying."
        ) from None
    jobs = [
        (provider, topic, concept, repetition)
        for provider in ["catalogue", "web_search", "hybrid"]
        for topic, concept in MANIFEST
        for repetition in range(3)
    ]
    random.Random(20261004).shuffle(jobs)
    if args.smoke:
        jobs = [("web_search", "React", "State", 0)]
    rows = []
    for provider, topic, concept, repetition in jobs:
        request = ResourceRequest(topic=topic, concept=concept)
        service = ResourceService(provider, meter)
        blocked = provider == "web_search" or (
            provider == "hybrid" and not catalogue_resources(request)
        )
        if blocked and meter is None:
            rows.append(
                {
                    "provider": provider,
                    "topic": topic,
                    "concept": concept,
                    "repetition": repetition,
                    "status": "blocked_missing_credential",
                }
            )
            continue
        before = meter.spent if meter else 0
        for temperature in ["cold", "warm"]:
            started = time.perf_counter()
            try:
                response = await service.get(request)
                row = {
                    "provider": provider,
                    "topic": topic,
                    "concept": concept,
                    "repetition": repetition,
                    "temperature": temperature,
                    "status": "measured",
                    "latency_ms": (time.perf_counter() - started) * 1000,
                    "resource_count": len(response.resources),
                    "cached": response.cached,
                    "source_urls": [r.url for r in response.resources],
                    "calculated_upper_bound_usd": (meter.spent - before) if meter else 0,
                }
            except Exception as exc:
                row = {
                    "provider": provider,
                    "topic": topic,
                    "concept": concept,
                    "repetition": repetition,
                    "temperature": temperature,
                    "status": "failed",
                    "error_type": type(exc).__name__,
                    "calculated_upper_bound_usd": (meter.spent - before) if meter else 0,
                }
            rows.append(row)
            before = meter.spent if meter else 0
            if row["status"] != "measured":
                break
    summaries = []
    for provider in ["catalogue", "web_search", "hybrid"]:
        for temperature in ["cold", "warm"]:
            measured = [
                r
                for r in rows
                if r["provider"] == provider
                and r.get("temperature") == temperature
                and r["status"] == "measured"
            ]
            times = sorted(r["latency_ms"] for r in measured)
            summaries.append(
                {
                    "provider": provider,
                    "temperature": temperature,
                    "measured_n": len(measured),
                    "coverage": sum(r["resource_count"] > 0 for r in measured),
                    "median_ms": statistics.median(times) if times else None,
                    "p95_ms": times[min(len(times) - 1, int(len(times) * 0.95))] if times else None,
                }
            )
    report = {
        "catalogue_version": CATALOGUE_VERSION,
        "seed": 20261004,
        "manifest": MANIFEST,
        "live": bool(client),
        "cap_usd": args.cap,
        "spend_upper_bound_usd": meter.spent if meter else 0,
        "prior_spend_upper_bound_usd": meter.prior_spend if meter else 0,
        "smoke": args.smoke,
        "billing_caveat": "Calculated conservative upper bound, not invoice. Fixed search content may be included in usage and counted twice. Failed calls reserve $0.10. No hidden retry.",
        "summary": summaries,
        "calls": meter.calls if meter else [],
        "observations": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(
        json.dumps({k: report[k] for k in ["live", "spend_upper_bound_usd", "summary"]}, indent=2)
    )
    if client:
        await client.close()
        meter.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--cap", type=float, default=5.0)
    parser.add_argument(
        "--smoke",
        action="store_true",
        help="One native-search preflight, using the shared budget ledger",
    )
    parser.add_argument(
        "--ledger", type=Path, default=Path("../evidence/resource-benchmark-ledger.json")
    )
    parser.add_argument("--output", type=Path, default=Path("../evidence/resource-benchmark.json"))
    asyncio.run(run(parser.parse_args()))
