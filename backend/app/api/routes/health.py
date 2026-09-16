from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", summary="Health check")
def health_check() -> dict[str, str]:
    """Simple liveness probe used by Docker/orchestrators and monitoring."""
    return {"status": "ok"}
