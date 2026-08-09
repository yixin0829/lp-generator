"""Immutable, unlisted learning-path snapshot storage."""

import base64
import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime

from google.api_core.exceptions import Conflict
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

    @staticmethod
    def _snapshot_id(snapshot: ShareSnapshot) -> str:
        """Return a stable 128-bit URL-safe ID for the exact validated snapshot."""
        canonical = json.dumps(
            snapshot.model_dump(mode="json"),
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
        digest = hashlib.sha256(canonical).digest()[:16]
        return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")

    def create(self, snapshot: ShareSnapshot) -> str:
        # Content addressing makes retries idempotent while retaining a 128-bit URL-safe ID.
        share_id = self._snapshot_id(snapshot)
        document = self._doc_ref(share_id)
        try:
            document.create(
                {
                    "snapshot": snapshot.model_dump(),
                    "created_at": datetime.now(UTC).isoformat(),
                }
            )
        except Conflict:
            try:
                existing = document.get()
                payload = (existing.to_dict() or {}).get("snapshot") if existing.exists else None
                if ShareSnapshot.model_validate(payload) != snapshot:
                    raise ShareServiceError("Share ID collision detected.")
            except ShareServiceError:
                raise
            except Exception as exc:
                raise ShareServiceError("Failed to verify the existing share snapshot.") from exc
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
