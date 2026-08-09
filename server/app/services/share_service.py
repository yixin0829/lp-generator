"""Immutable, unlisted learning-path snapshot storage."""

import secrets
from dataclasses import dataclass
from datetime import UTC, datetime

from google.cloud import firestore

from app.schemas.share import ShareSnapshot


class ShareServiceError(Exception):
    """Storage failure safe to map to a service-unavailable response."""


class ShareStorageDisabled(ShareServiceError):
    """Sharing is not configured for this deployment."""


@dataclass(frozen=True)
class ShareConfig:
    collection: str


class BaseShareService:
    enabled = True

    def create(self, snapshot: ShareSnapshot) -> str:
        raise NotImplementedError

    def get(self, share_id: str) -> ShareSnapshot | None:
        raise NotImplementedError


class NoopShareService(BaseShareService):
    enabled = False

    def create(self, snapshot: ShareSnapshot) -> str:
        raise ShareStorageDisabled("Sharing is not enabled on this deployment.")

    def get(self, share_id: str) -> ShareSnapshot | None:
        raise ShareStorageDisabled("Sharing is not enabled on this deployment.")


class FirestoreShareService(BaseShareService):
    def __init__(self, client: firestore.Client, config: ShareConfig) -> None:
        self._client = client
        self._config = config

    def _doc_ref(self, share_id: str):
        return self._client.collection(self._config.collection).document(share_id)

    def create(self, snapshot: ShareSnapshot) -> str:
        # token_urlsafe(16) contains 128 bits of entropy and is safe in a URL path.
        share_id = secrets.token_urlsafe(16)
        try:
            self._doc_ref(share_id).create(
                {
                    "snapshot": snapshot.model_dump(),
                    "created_at": datetime.now(UTC).isoformat(),
                }
            )
        except Exception as exc:
            raise ShareServiceError("Failed to store the share snapshot.") from exc
        return share_id

    def get(self, share_id: str) -> ShareSnapshot | None:
        try:
            document = self._doc_ref(share_id).get()
            if not document.exists:
                return None
            payload = (document.to_dict() or {}).get("snapshot")
            return ShareSnapshot.model_validate(payload)
        except ShareServiceError:
            raise
        except Exception as exc:
            raise ShareServiceError("Failed to retrieve the share snapshot.") from exc
