"""Service for persisting and retrieving saved learning paths in Firestore."""

from __future__ import annotations

import re
import string
from datetime import datetime, timezone
from typing import Any

from google.cloud import firestore
from loguru import logger


class SavedLPServiceError(Exception):
    """Raised when saved-LP storage operations fail."""


def to_slug(topic: str) -> str:
    """URL-safe slug from a topic string.

    Must stay in sync with the frontend's toSlug() in util/slug.js.
    """
    slug = topic.lower()
    slug = slug.translate(str.maketrans("", "", string.punctuation))
    slug = slug.strip()
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug)
    return slug


class SavedLPService:
    """Firestore-backed storage for saved learning paths."""

    def __init__(self, client: firestore.Client, collection: str) -> None:
        self._client = client
        self._collection = collection

    def _col(self):
        return self._client.collection(self._collection)

    def get(self, topic_slug: str) -> dict[str, Any] | None:
        """Return a saved LP document or None if not found."""
        try:
            doc = self._col().document(topic_slug).get()
            if not doc.exists:
                return None
            return doc.to_dict()
        except Exception as e:
            raise SavedLPServiceError(f"Failed to read saved LP '{topic_slug}': {e}") from e

    def upsert(
        self,
        topic: str,
        completion: dict[str, list[str]],
        model: str,
        usage: dict[str, int] | None = None,
        published: bool = False,
    ) -> dict[str, Any]:
        """Create or update a saved learning path.  Returns the stored document."""
        topic_slug = to_slug(topic)
        now = datetime.now(timezone.utc)

        existing = self.get(topic_slug)
        doc: dict[str, Any] = {
            "topic": topic,
            "topicSlug": topic_slug,
            "completion": completion,
            "model": model,
            "updatedAt": now,
            "published": published,
        }
        if usage:
            doc["usage"] = usage
        if existing and "createdAt" in existing:
            doc["createdAt"] = existing["createdAt"]
        else:
            doc["createdAt"] = now

        try:
            self._col().document(topic_slug).set(doc)
        except Exception as e:
            raise SavedLPServiceError(f"Failed to save LP '{topic_slug}': {e}") from e

        logger.info("Saved LP upserted: slug={}, published={}", topic_slug, published)
        return doc

    def list_published(self) -> list[dict[str, Any]]:
        """Return all published saved LPs (lightweight: slug + topic + dates)."""
        try:
            query = (
                self._col()
                .where("published", "==", True)
                .select(["topic", "topicSlug", "updatedAt"])
            )
            return [doc.to_dict() for doc in query.stream()]
        except Exception as e:
            raise SavedLPServiceError(f"Failed to list published LPs: {e}") from e


class NoopSavedLPService:
    """Fallback when Firestore is unavailable."""

    def get(self, topic_slug: str) -> dict[str, Any] | None:
        return None

    def upsert(self, **kwargs) -> dict[str, Any]:
        raise SavedLPServiceError("Saved LP storage is not configured (noop).")

    def list_published(self) -> list[dict[str, Any]]:
        return []
