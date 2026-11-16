from typing import Any, Dict, Optional
from fastapi import APIRouter
from pydantic import BaseModel

from code_review.agent import execute_code_in_sandbox, review_code

router = APIRouter()


class CodeReviewRequest(BaseModel):
    code: str
    language: Optional[str] = "python"


class CodeExecRequest(BaseModel):
    code: str
    language: str = "python"
    stdin: str = ""


@router.post("/api/code-review")
async def api_code_review(payload: CodeReviewRequest) -> Dict[str, Any]:
    return review_code(payload.code, payload.language)


@router.post("/api/code-execution")
async def api_code_execution(payload: CodeExecRequest) -> Dict[str, Any]:
    return execute_code_in_sandbox(payload.code, payload.language, payload.stdin)
