"""A bounded, model-specific history of successful uncached request durations."""

import hashlib
import math
import time
from threading import Lock

from google.cloud import firestore
from loguru import logger

from app.schemas.stats import GenerationEstimate

MAX_SAMPLES = 100
MAX_AGE_SECONDS = 7 * 24 * 60 * 60
MIN_SAMPLES = 5


def recent_samples(samples: list[dict], now: float) -> list[dict]:
    return sorted(
        [
            sample
            for sample in samples
            if 0 <= now - sample["at"] < MAX_AGE_SECONDS
            and math.isfinite(sample["seconds"])
            and sample["seconds"] > 0
        ],
        key=lambda sample: sample["at"],
    )[-MAX_SAMPLES:]


class GenerationTimingService:
    """Use Firestore transactions in hosted environments, memory for local dev.

    Timing failures never prevent generation or the rest of the stats response.
    Only durations and timestamps are stored; topic text is not needed.
    """

    def __init__(self, model: str, client=None, collection: str = "generation_timings"):
        self.model = model
        self._client = client
        # Bump the version when generation work or reasoning settings change.
        key = hashlib.sha256(f"v1:{model}".encode()).hexdigest()
        self._document = client.collection(collection).document(key) if client else None
        self._samples: list[dict] = []
        self._lock = Lock()

    def record(self, seconds: float) -> None:
        if not math.isfinite(seconds) or seconds <= 0:
            return
        now = time.time()
        sample = {"seconds": seconds, "at": now}
        try:
            if self._document is not None:

                @firestore.transactional
                def append(transaction):
                    snapshot = self._document.get(transaction=transaction, timeout=2, retry=None)
                    samples = (snapshot.to_dict() or {}).get("samples", [])
                    transaction.set(
                        self._document,
                        {"samples": recent_samples([*samples, sample], now)},
                    )

                append(self._client.transaction(max_attempts=2))
            else:
                with self._lock:
                    self._samples = recent_samples([*self._samples, sample], now)
        except Exception:
            logger.warning("Unable to record generation timing")

    def estimate(self) -> GenerationEstimate | None:
        try:
            if self._document is not None:
                samples = (self._document.get(timeout=2, retry=None).to_dict() or {}).get(
                    "samples", []
                )
            else:
                with self._lock:
                    samples = list(self._samples)
            durations = sorted(s["seconds"] for s in recent_samples(samples, time.time()))
            if len(durations) < MIN_SAMPLES:
                return None

            def percentile(fraction):
                return durations[math.ceil(len(durations) * fraction) - 1]

            lower = max(5, math.floor(percentile(0.2) / 5) * 5)
            upper = max(lower + 5, math.ceil(percentile(0.8) / 5) * 5)
            return GenerationEstimate(
                model=self.model,
                sample_count=len(durations),
                median_seconds=percentile(0.5),
                lower_seconds=lower,
                upper_seconds=upper,
            )
        except Exception:
            logger.warning("Unable to read generation timing")
            return None
