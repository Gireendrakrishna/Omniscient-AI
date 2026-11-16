from typing import Any, Dict
from fastapi import APIRouter
from pydantic import BaseModel

from web_research.agent import run_web_research

router = APIRouter()


class ResearchRequest(BaseModel):
    query: str


@router.post("/api/research")
async def api_research(payload: ResearchRequest) -> Dict[str, Any]:
    return run_web_research(payload.query)
