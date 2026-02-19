from pydantic import BaseModel
from typing import Optional

class InspectionOut(BaseModel):
    id: str
    batch_id: str
    operator_id: str
    status: str
    defect_count: int
    notes: Optional[str]
    created_at: str
