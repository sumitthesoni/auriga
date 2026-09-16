from fastapi import APIRouter, Depends

from app.api.dependencies import AssignmentServiceDep
from app.core.security import get_current_user
from app.schemas.user import UserRead

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserRead], summary="List helpdesk employees")
def list_users(
    assignment_service: AssignmentServiceDep,
    current_user=Depends(get_current_user),
) -> list[UserRead]:
    """Return every helpdesk employee, for use in assignee selectors/filters."""
    return assignment_service.list_employees()
