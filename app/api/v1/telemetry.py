from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()

class TelemetryPoint(BaseModel):
    ts: str
    machine_id: str
    metric: str
    value: float

@router.post("/bulk")
async def ingest_telemetry(points: List[TelemetryPoint]):
    # TODO: write to TimescaleDB or Kafka
    count = len(points)
    return {"ingested": count}
