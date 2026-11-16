"""
Code Review & IDE Sandbox Execution Agent (backend/code_review/agent.py)
- Supports `input()` and `sys.stdin` with custom Standard Input (`stdin`) just like a normal IDE / LeetCode.
- Combines Python AST static analysis with live Groq AI Code Review to detect logical bugs,
  algorithmic inefficiencies, edge cases, and security issues, and generates genuinely
  optimized/remediated code.
"""

import ast
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from typing import Any, Dict, List, Optional

from config import ask_llm

# Only block dangerous OS/network/filesystem escape modules; allow `input()`, `sys`, `math`, `collections`, etc.
FORBIDDEN_MODULES = {"subprocess", "socket", "shutil", "ctypes", "urllib", "http", "ftplib"}
FORBIDDEN_BUILTINS = {"eval", "exec", "compile", "__import__", "open"}


def detect_language(code: str, hint: Optional[str] = None) -> str:
    if hint and hint.lower() not in ("auto", ""):
        return hint.lower()
    if re.search(r"\bpublic\s+class\s+\w+|System\.out\.println", code):
        return "java"
    if re.search(r"#include\s*<(iostream|vector|string)>|\bstd::", code):
        return "cpp"
    if re.search(r"#include\s*<stdio\.h>|\bprintf\s*\(", code):
        return "c"
    if re.search(r"\binterface\s+\w+|:\s*(string|number|boolean)\b", code):
        return "typescript"
    if re.search(r"\b(const|let|function)\s+\w+|console\.log\s*\(", code):
        return "javascript"
    return "python"


def review_code(code: str, language_hint: Optional[str] = None) -> Dict[str, Any]:
    lang = detect_language(code, language_hint)
    issues: List[Dict[str, Any]] = []

    # 1. Fast Static AST & Pattern Checks
    if lang == "python":
        try:
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                    if node.func.id in ("eval", "exec"):
                        issues.append({
                            "affected_line": getattr(node, "lineno", 1),
                            "severity": "critical",
                            "issue_description": f"Dangerous use of `{node.func.id}()` enables arbitrary code execution.",
                            "explanation": f"`{node.func.id}()` executes dynamically constructed strings.",
                            "suggested_correction": "Use `ast.literal_eval()` or structured parsing.",
                        })
                elif isinstance(node, ast.FunctionDef):
                    for d in node.args.defaults:
                        if isinstance(d, (ast.List, ast.Dict, ast.Set)):
                            issues.append({
                                "affected_line": getattr(node, "lineno", 1),
                                "severity": "high",
                                "issue_description": f"Mutable default argument in `{node.name}()`.",
                                "explanation": "Mutable defaults (`[]` or `{}`) persist across calls.",
                                "suggested_correction": "Use `None` as default and initialize inside the function.",
                            })
                elif isinstance(node, ast.ExceptHandler) and node.type is None:
                    issues.append({
                        "affected_line": getattr(node, "lineno", 1),
                        "severity": "medium",
                        "issue_description": "Bare `except:` clause masks unexpected exceptions.",
                        "explanation": "Catching all exceptions without `Exception` hides system exits and bugs.",
                        "suggested_correction": "Use `except Exception as exc:`.",
                    })
        except SyntaxError as exc:
            issues.append({
                "affected_line": exc.lineno or 1,
                "severity": "critical",
                "issue_description": f"SyntaxError: {exc.msg}",
                "explanation": f"Invalid Python syntax on line {exc.lineno}.",
                "suggested_correction": "Fix indentation, colons, or unclosed brackets.",
            })

    for idx, line in enumerate(code.splitlines(), start=1):
        if re.search(r"(api_key|secret|password|token)\s*=\s*['\"][A-Za-z0-9_\-]{8,}['\"]", line, re.I):
            issues.append({
                "affected_line": idx,
                "severity": "critical",
                "issue_description": "Hardcoded API key or secret detected.",
                "explanation": "Secrets in source code can be leaked via version control.",
                "suggested_correction": "Load secrets from `.env` using `os.environ.get()`.",
            })
        if re.search(r"(SELECT|DELETE|UPDATE|INSERT)\s+.*(\+|%s|\{.*\}).*FROM", line, re.I):
            issues.append({
                "affected_line": idx,
                "severity": "critical",
                "issue_description": "SQL Injection vulnerability via string concatenation.",
                "explanation": "Concatenating user input into SQL queries allows attackers to alter query logic.",
                "suggested_correction": "Use parameterized `?` placeholders (`PreparedStatement`).",
            })
        if lang in ("c", "cpp") and re.search(r"\b(gets|strcpy)\s*\(", line):
            issues.append({
                "affected_line": idx,
                "severity": "critical",
                "issue_description": "Buffer overflow risk with unbounded memory copy.",
                "explanation": "`gets` and `strcpy` do not check buffer bounds.",
                "suggested_correction": "Use `fgets()` or `strncpy()`.",
            })

    # Fallback complexity & regex remediation
    loop_count = len(re.findall(r"^\s*(for|while)\b", code, re.M))
    time_c = "O(n^2)" if loop_count >= 2 else ("O(n)" if loop_count == 1 else "O(1)")
    space_c = "O(n)" if re.search(r"\[\]|\{\}|\blist\(|\bdict\(", code) else "O(1)"

    corrected = code
    corrected = re.sub(r"\beval\s*\(", "ast.literal_eval(", corrected)
    corrected = re.sub(
        r"(api_key|secret|password|token)\s*=\s*['\"][^'\"]+['\"]",
        r'\1 = os.environ.get("\1".upper(), "")',
        corrected,
        flags=re.I,
    )
    corrected = re.sub(r"\bgets\s*\(\s*(\w+)\s*\)", r"fgets(\1, sizeof(\1), stdin)", corrected)
    summary = f"Reviewed {len(code.splitlines())} lines of {lang.upper()} code. Found {len(issues)} issue(s)."

    # 2. Deep AI Code Review & Optimization via Groq (detects logic bugs, indentation errors, & optimizes code!)
    try:
        ai_prompt = (
            f"Analyze the following {lang} code for syntax errors, logical bugs, indentation mistakes, "
            f"edge-case failures, and algorithmic optimizations.\n"
            f"Return ONLY a valid JSON object with these exact keys:\n"
            f'{{\n'
            f'  "summary": "1-2 sentence technical summary",\n'
            f'  "time_complexity": "Big-O time complexity (e.g. O(n * k))",\n'
            f'  "time_explanation": "Brief explanation of time complexity",\n'
            f'  "space_complexity": "Big-O space complexity (e.g. O(n * k))",\n'
            f'  "space_explanation": "Brief explanation of space complexity",\n'
            f'  "issues": [\n'
            f'    {{"affected_line": 1, "severity": "high", "issue_description": "...", "explanation": "...", "suggested_correction": "..."}}\n'
            f'  ],\n'
            f'  "corrected_code": "Complete, fixed, clean, and optimized {lang} code string"\n'
            f'}}\n\n'
            f"Source Code:\n```{lang}\n{code}\n```"
        )
        llm_res = ask_llm(
            prompt=ai_prompt,
            system_prompt="You are a Principal Software Engineer & Competitive Programming Judge. Output raw JSON only.",
        )
        if llm_res.get("provider") == "groq":
            raw_content = llm_res.get("content", "")
            json_match = re.search(r"\{[\s\S]*\}", raw_content)
            if json_match:
                parsed = json.loads(json_match.group(0))
                if parsed.get("corrected_code"):
                    corrected = parsed["corrected_code"]
                if parsed.get("summary"):
                    summary = parsed["summary"]
                if parsed.get("time_complexity"):
                    time_c = parsed["time_complexity"]
                if parsed.get("space_complexity"):
                    space_c = parsed["space_complexity"]
                ai_issues = parsed.get("issues", [])
                if isinstance(ai_issues, list) and ai_issues:
                    # Merge static issues and AI-detected logical issues
                    existing_lines = {(i["affected_line"], i["issue_description"]) for i in issues}
                    for ai_i in ai_issues:
                        if isinstance(ai_i, dict) and ai_i.get("issue_description"):
                            key = (ai_i.get("affected_line", 1), ai_i.get("issue_description"))
                            if key not in existing_lines:
                                issues.append({
                                    "affected_line": int(ai_i.get("affected_line", 1)),
                                    "severity": str(ai_i.get("severity", "medium")).lower(),
                                    "issue_description": str(ai_i.get("issue_description")),
                                    "explanation": str(ai_i.get("explanation", "")),
                                    "suggested_correction": str(ai_i.get("suggested_correction", "")),
                                })
    except Exception:
        pass

    return {
        "language": lang,
        "summary": summary,
        "issues_count": len(issues),
        "issues": issues,
        "time_complexity": time_c,
        "time_complexity_explanation": f"Analyzed loop nesting and operations ({time_c}).",
        "space_complexity": space_c,
        "space_complexity_explanation": f"Analyzed auxiliary data structures ({space_c}).",
        "original_code": code,
        "corrected_code": corrected,
    }


def execute_code_in_sandbox(
    code: str,
    language: str = "python",
    stdin_data: str = "",
) -> Dict[str, Any]:
    """
    Executes Python code inside an isolated temporary directory subprocess.
    Supports `input()` and `sys.stdin` using `stdin_data`, just like a standard IDE!
    """
    if language.lower() != "python":
        return {
            "success": False,
            "language": language,
            "stdout": "",
            "stderr": f"Sandbox execution runs Python natively (received {language}). Use Code Review for {language}.",
            "exit_code": 1,
            "execution_time_ms": 0,
            "sandbox_mode": "python-ide-sandbox",
        }

    try:
        tree = ast.parse(code)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for a in node.names:
                    root_mod = a.name.split(".")[0]
                    if root_mod in FORBIDDEN_MODULES or root_mod == "os":
                        return {
                            "success": False,
                            "language": "python",
                            "stdout": "",
                            "stderr": f"Security Policy: Import of '{a.name}' is restricted inside the sandbox.",
                            "exit_code": 126,
                            "execution_time_ms": 0,
                            "sandbox_mode": "ast-security-guard",
                        }
            elif isinstance(node, ast.ImportFrom):
                root_mod = (node.module or "").split(".")[0]
                if root_mod in FORBIDDEN_MODULES or root_mod == "os":
                    return {
                        "success": False,
                        "language": "python",
                        "stdout": "",
                        "stderr": f"Security Policy: Import from '{node.module}' is restricted inside the sandbox.",
                        "exit_code": 126,
                        "execution_time_ms": 0,
                        "sandbox_mode": "ast-security-guard",
                    }
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                if node.func.id in FORBIDDEN_BUILTINS:
                    return {
                        "success": False,
                        "language": "python",
                        "stdout": "",
                        "stderr": f"Security Policy: Call to '{node.func.id}()' is restricted inside the sandbox.",
                        "exit_code": 126,
                        "execution_time_ms": 0,
                        "sandbox_mode": "ast-security-guard",
                    }
    except SyntaxError as exc:
        return {
            "success": False,
            "language": "python",
            "stdout": "",
            "stderr": f"SyntaxError on line {exc.lineno}: {exc.msg}",
            "exit_code": 1,
            "execution_time_ms": 0,
            "sandbox_mode": "python-ide-sandbox",
        }

    # Ensure stdin ends with a newline if non-empty so `input()` reads cleanly
    formatted_stdin = stdin_data if (not stdin_data or stdin_data.endswith("\n")) else (stdin_data + "\n")

    start_ts = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix="omniscient_ide_") as tmp_dir:
        script_path = Path(tmp_dir) / "main.py"
        script_path.write_text(code, encoding="utf-8")
        safe_env = {
            "PATH": os.environ.get("PATH", ""),
            "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
            "PYTHONIOENCODING": "utf-8",
        }
        try:
            proc = subprocess.run(
                [sys.executable, "-I", str(script_path)],
                cwd=tmp_dir,
                env=safe_env,
                input=formatted_stdin,
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            ms = int((time.perf_counter() - start_ts) * 1000)
            stderr_out = proc.stderr[:8000]
            if "EOFError: EOF when reading a line" in stderr_out:
                stderr_out += (
                    "\n\n💡 [IDE Hint]: Your program called `input()`, but the Standard Input (stdin) box "
                    "had no more lines to read. Enter your program input in the 'Standard Input (stdin)' box and run again!"
                )
            return {
                "success": proc.returncode == 0,
                "language": "python",
                "stdout": proc.stdout[:8000],
                "stderr": stderr_out,
                "exit_code": proc.returncode,
                "execution_time_ms": ms,
                "sandbox_mode": "python-ide-sandbox",
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "language": "python",
                "stdout": "",
                "stderr": "Execution timed out after 5 seconds (check for infinite loops or waiting on input).",
                "exit_code": 124,
                "execution_time_ms": 5000,
                "sandbox_mode": "python-ide-sandbox",
            }
