"""Create and retrieve immutable, unlisted learning-path shares."""

import json
import re

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.config import get_config
from app.core.dependencies import get_learning_path_service, get_share_service
from app.core.security import limiter, require_api_key
from app.schemas.share import ShareCreateResponse, ShareResponse, ShareSnapshot
from app.services.learning_path_service import LearningPathError, LearningPathService
from app.services.share_service import BaseShareService, ShareServiceError, ShareStorageDisabled

config = get_config()
router = APIRouter(
    prefix="/shares",
    tags=["shares"],
    dependencies=[Depends(require_api_key)],
)
SHARE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{22}$")
MAX_SNAPSHOT_BYTES = 128_000


@router.post("", response_model=ShareCreateResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(config.share_rate_limit)
async def create_share(
    request: Request,
    snapshot: ShareSnapshot,
    service: BaseShareService = Depends(get_share_service),
    learning_path_service: LearningPathService = Depends(get_learning_path_service),
) -> ShareCreateResponse:
    if not service.enabled:
        raise HTTPException(status_code=503, detail="Sharing is not enabled on this deployment.")
    serialized = json.dumps(snapshot.model_dump(), ensure_ascii=False).encode("utf-8")
    if len(serialized) > MAX_SNAPSHOT_BYTES:
        raise HTTPException(status_code=413, detail="Share snapshot is too large.")

    moderation_text = json.dumps(snapshot.model_dump(), ensure_ascii=False)
    moderation_input = [
        moderation_text[index : index + 8_000]
        for index in range(0, len(moderation_text), 8_000)
    ]
    try:
        await learning_path_service.check_moderation(moderation_input)
        share_id = service.create(snapshot)
    except LearningPathError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except ShareStorageDisabled as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ShareServiceError as exc:
        raise HTTPException(status_code=503, detail="Share storage is temporarily unavailable.") from exc
    return ShareCreateResponse(share_id=share_id)


@router.get("/{share_id}", response_model=ShareResponse)
async def get_share(
    share_id: str,
    service: BaseShareService = Depends(get_share_service),
) -> ShareResponse:
    if not SHARE_ID_PATTERN.fullmatch(share_id):
        raise HTTPException(status_code=404, detail="Share not found.")
    try:
        snapshot = service.get(share_id)
    except ShareStorageDisabled as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ShareServiceError as exc:
        raise HTTPException(status_code=503, detail="Share storage is temporarily unavailable.") from exc
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Share not found.")
    return ShareResponse(share_id=share_id, snapshot=snapshot)
