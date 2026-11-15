from typing import Literal

from pydantic import BaseModel, Field


Strategy = Literal["least-distance", "minimum-interchange"]


class StationRef(BaseModel):
    code: str
    name: str
    name_kn: str


class JourneyLeg(BaseModel):
    line_code: str
    line_name: str
    line_name_kn: str
    color: str
    color_hex: str | None = None
    from_station: StationRef
    to_station: StationRef
    stations: list[StationRef]
    hop_count: int


class Fare(BaseModel):
    zone: str
    token: float
    smart_card_peak: float
    smart_card_off_peak: float
    group_ticket: float
    source: Literal["bmrc"] = "bmrc"


class Parking(BaseModel):
    station_code: str
    station_name: str
    two_wheeler: int | None = None
    four_wheeler: int | None = None
    lcv: int | None = None


class JourneyPlan(BaseModel):
    from_station: StationRef
    to_station: StationRef
    strategy: Strategy
    strategies_differ: bool
    station_count: int = Field(
        description="Stations travelled excluding the origin. This is the hop count, not kilometres.",
    )
    legs: list[JourneyLeg]
    interchanges: list[StationRef]
    fare: Fare
    parking_at_origin: Parking | None = None
