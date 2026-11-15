"""Caller errors and upstream failures stay in different types."""

from dataclasses import dataclass


@dataclass(slots=True)
class UpstreamApiError(Exception):
    """BMRCL returned something we cannot use."""

    message: str
    status_code: int | None = None

    def __str__(self) -> str:
        if self.status_code is None:
            return self.message
        return f"{self.message} (status={self.status_code})"


@dataclass(slots=True)
class ApiRequestError(Exception):
    """A request we rejected before calling BMRCL."""

    message: str
    status_code: int = 400

    def __str__(self) -> str:
        return self.message
