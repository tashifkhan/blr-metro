from pydantic import BaseModel, Field


class StationLine(BaseModel):
    line_code: str
    line_id: int
    line_name: str
    line_name_kn: str
    color: str
    color_hex: str | None = None
    order: int


class Station(BaseModel):
    code: str
    name: str
    name_kn: str
    latitude: float | None = None
    longitude: float | None = None
    interchange: bool
    lines: list[StationLine]


class Line(BaseModel):
    code: str
    line_id: int
    name: str
    name_kn: str
    color: str
    color_hex: str | None = None
    station_count: int
    start_station: str | None = None
    end_station: str | None = None


class LineDetail(Line):
    stations: list[Station] = Field(default_factory=list)
