from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["estado"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
