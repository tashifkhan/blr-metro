from pydantic import BaseModel


class ApiErrorResponse(BaseModel):
    detail: str
    upstream_status_code: int | None = None
