import React, { useRef, useState } from "react";
import {
  ShieldAlert,
  Play,
  CheckCircle2,
  Code2,
  Cpu,
  FileDiff,
  Terminal,
  Copy,
} from "lucide-react";
import { apiRequest } from "../api";

const SAMPLE_SNIPPETS: Record<string, { code: string; stdin: string }> = {
  python: {
    code: `# Interactive Python IDE — Supports input() and sys.stdin!
A = int(input())
B = int(input())
print(f"A = {A}, B = {B}, Sum = {A + B}")`,
    stdin: `42\n58`,
  },
  javascript: {
    code: `function findDuplicates(arr) {
    const seen = [];
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] == "admin") {
            document.body.innerHTML = arr[i];
        }
    }
    return seen;
}`,
    stdin: "",
  },
  typescript: {
    code: `function sumNumbers(nums: number[]): number {
    let total = 0;
    for (const n of nums) {
        total += n;
    }
    return total;
}`,
    stdin: "",
  },
  java: {
    code: `public class UserQuery {
    public void fetchUser(java.sql.Statement stmt, String username) throws Exception {
        String sql = "SELECT * FROM users WHERE username = '" + username + "'";
        stmt.executeQuery(sql);
    }
}`,
    stdin: "",
  },
  cpp: {
    code: `#include <iostream>
#include <cstring>

void copyInput() {
    char buf[16];
    gets(buf);
    std::cout << buf << std::endl;
}`,
    stdin: "",
  },
  c: {
    code: `#include <stdio.h>
int main() {
    char name[16];
    gets(name);
    printf("Hello %s\\n", name);
    return 0;
}`,
    stdin: "",
  },
};

export const CodeReviewView: React.FC = () => {
  const [language, setLanguage] = useState<string>("python");
  const [code, setCode] = useState<string>(SAMPLE_SNIPPETS.python.code);
  const [stdinText, setStdinText] = useState<string>(SAMPLE_SNIPPETS.python.stdin);
  const [reviewReport, setReviewReport] = useState<any | null>(null);
  const [execResult, setExecResult] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const stdinRef = useRef<HTMLTextAreaElement | null>(null);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    if (SAMPLE_SNIPPETS[lang]) {
      setCode(SAMPLE_SNIPPETS[lang].code);
      setStdinText(SAMPLE_SNIPPETS[lang].stdin);
    }
  };

  // Support Tab indentation and Ctrl+Enter to run like a real IDE
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated = code.substring(0, start) + "    " + code.substring(end);
      setCode(updated);
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.selectionStart = editorRef.current.selectionEnd = start + 4;
        }
      }, 0);
    } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runInSandbox();
    }
  };

  const runCodeReview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest("/api/code-review", {
        method: "POST",
        body: JSON.stringify({ code, language }),
      });
      setReviewReport(data);
    } catch (err: any) {
      setError(err.message || "Code review failed");
    } finally {
      setLoading(false);
    }
  };

  const runInSandbox = async () => {
    setLoading(true);
    setError(null);

    let effectiveStdin = stdinText;
    const usesInput = /\binput\s*\(/.test(code);
    if (usesInput && !effectiveStdin.trim()) {
      const prompted = window.prompt(
        "Your code calls input(). Enter the Standard Input (stdin) lines (use commas or spaces for multiple lines):",
        "10"
      );
      if (prompted !== null) {
        effectiveStdin = prompted.replace(/,\s*/g, "\n");
        setStdinText(effectiveStdin);
      }
    }

    try {
      const data = await apiRequest("/api/code-execution", {
        method: "POST",
        body: JSON.stringify({ code, language, stdin: effectiveStdin }),
      });
      setExecResult(data);
    } catch (err: any) {
      setError(err.message || "Sandbox execution failed");
    } finally {
      setLoading(false);
    }
  };

  const lineCount = Math.max(1, code.split("\n").length);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D4AF37]/25 pb-5">
        <div>
          <h2 className="text-xl font-bold text-[#FFFFFF] flex items-center gap-2.5">
            <Code2 className="w-5 h-5 text-[#D4AF37]" />
            IDE Code Studio, AI Code Review & Sandbox Runner
          </h2>
          <p className="text-xs text-[#BDBDBD] mt-1">
            Full IDE editor with Tab indentation, `input()` / `stdin` console, AI bug & complexity analysis, and sandbox execution (`Ctrl + Enter` to run).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="input-field"
          >
            <option value="python">Python 3.13</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
            <option value="c">C</option>
          </select>

          <button onClick={runCodeReview} disabled={loading} className="btn-secondary">
            <ShieldAlert className="w-4 h-4 text-[#D4AF37]" />
            {loading ? "Analyzing..." : "Run AI Code Review"}
          </button>

          <button onClick={runInSandbox} disabled={loading} className="btn-primary">
            <Play className="w-4 h-4" />
            {loading ? "Running..." : "Run Code (Ctrl+Enter)"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-[#0A0A0A] border border-[#B22222] text-xs text-[#B22222]">
          {error}
        </div>
      )}

      {/* Main Editor + Corrected Code Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: IDE Code Editor with Line Numbers */}
        <div className="surface-card flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
              IDE Source Editor ({language.toUpperCase()})
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setCode(
                    `class Solution:\n    def groupAnagrams(self, strs: list[str]) -> list[list[str]]:\n        primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101]\n        groups = {}\n        for s in strs:\n            m = 1\n            for c in s:\n                m *= primes[ord(c) - ord('a')]\n            if m not in groups:\n                groups[m] = []\n            groups[m].append(s)\n        return list(groups.values())\n\nwords = input().split()\nprint(Solution().groupAnagrams(words))`
                  );
                  setStdinText("eat tea tan ate nat bat");
                }}
                className="text-xs text-[#BDBDBD] hover:text-[#D4AF37] transition-colors"
              >
                Load Anagrams Demo
              </button>
              <button
                type="button"
                onClick={() => {
                  setCode(SAMPLE_SNIPPETS.python.code);
                  setStdinText(SAMPLE_SNIPPETS.python.stdin);
                }}
                className="text-xs text-[#D4AF37] hover:underline"
              >
                Load input() Demo
              </button>
            </div>
          </div>

          <div className="flex flex-1 rounded-lg border border-[#D4AF37]/30 bg-[#000000] overflow-hidden focus-within:border-[#D4AF37]">
            {/* Line Number Gutter */}
            <div className="select-none py-3.5 px-2.5 bg-[#0A0A0A] border-r border-[#D4AF37]/20 text-right font-mono text-xs text-[#777777] leading-relaxed">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i + 1}>{i + 1}</div>
              ))}
            </div>
            {/* Code Textarea */}
            <textarea
              ref={editorRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleEditorKeyDown}
              rows={14}
              spellCheck={false}
              className="w-full flex-1 bg-[#000000] p-3.5 font-mono text-xs text-[#FFFFFF] leading-relaxed outline-none resize-y"
            />
          </div>
        </div>

        {/* Right: AI Remediated / Optimized Code */}
        <div className="surface-card flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#FFFFFF] flex items-center gap-1.5">
              <FileDiff className="w-4 h-4 text-[#D4AF37]" />
              AI Remediated & Optimized Code
            </span>
            {reviewReport && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(reviewReport.corrected_code)}
                  className="text-xs text-[#BDBDBD] hover:text-[#FFFFFF] flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => setCode(reviewReport.corrected_code)}
                  className="text-xs text-[#D4AF37] font-semibold hover:underline"
                >
                  Apply Fix to Editor
                </button>
              </div>
            )}
          </div>
          <pre className="w-full flex-1 bg-[#000000] border border-[#D4AF37]/30 rounded-lg p-3.5 font-mono text-xs text-[#BDBDBD] leading-relaxed overflow-auto">
            {reviewReport
              ? reviewReport.corrected_code
              : "// Click 'Run AI Code Review' to detect logical/syntax bugs and generate optimized code."}
          </pre>
        </div>
      </div>

      {/* IDE Standard Input (stdin) & Standard Output (stdout/stderr) Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Standard Input (stdin) Box */}
        <div className="surface-card flex flex-col space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
              <Terminal className="w-4 h-4" />
              Standard Input (stdin)
            </span>
            <span className="text-[10px] font-mono text-[#777777]">
              For `input()` / `sys.stdin`
            </span>
          </div>
          <textarea
            ref={stdinRef}
            value={stdinText}
            onChange={(e) => setStdinText(e.target.value)}
            rows={5}
            placeholder="Enter program inputs here (one line per input() call)..."
            className="w-full flex-1 bg-[#000000] border border-[#D4AF37]/30 rounded-lg p-3 font-mono text-xs text-[#FFFFFF] placeholder-[#777777] focus:border-[#D4AF37] outline-none resize-y"
          />
        </div>

        {/* Standard Output / Terminal Console */}
        <div className="surface-card lg:col-span-2 flex flex-col space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FFFFFF] flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#D4AF37]" />
              Terminal Output Console
            </h3>
            {execResult && (
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-mono border ${
                  execResult.success
                    ? "bg-[#0A0A0A] text-emerald-400 border-emerald-500/40"
                    : "bg-[#0A0A0A] text-[#B22222] border-[#B22222]"
                }`}
              >
                Exit Code: {execResult.exit_code} • {execResult.execution_time_ms} ms
              </span>
            )}
          </div>

          <div className="flex-1 rounded-lg bg-[#000000] border border-[#D4AF37]/25 p-3.5 font-mono text-xs overflow-auto min-h-[120px]">
            {!execResult ? (
              <span className="text-[#777777]">
                // Click "Run Code (Ctrl+Enter)" to execute your program with the Standard Input (stdin) on the left.
              </span>
            ) : (
              <div className="space-y-2">
                {execResult.stdout ? (
                  <pre className="text-[#FFFFFF] whitespace-pre-wrap">{execResult.stdout}</pre>
                ) : (
                  !execResult.stderr && (
                    <span className="text-[#777777]">(Program finished with no output)</span>
                  )
                )}
                {execResult.stderr && (
                  <pre className="text-[#B22222] whitespace-pre-wrap border-t border-[#B22222]/30 pt-2">
                    {execResult.stderr}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vulnerability & Complexity Analysis Report */}
      {reviewReport && (
        <div className="surface-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#FFFFFF]">
              AI Code Review & Complexity Analysis
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="px-3 py-1 rounded bg-[#000000] border border-[#D4AF37]/50 text-[#D4AF37] font-mono">
                Time: {reviewReport.time_complexity}
              </span>
              <span className="px-3 py-1 rounded bg-[#000000] border border-[#D4AF37]/50 text-[#FFFFFF] font-mono">
                Space: {reviewReport.space_complexity}
              </span>
            </div>
          </div>

          <p className="text-xs text-[#BDBDBD]">{reviewReport.summary}</p>

          <div className="space-y-2.5">
            {reviewReport.issues.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                No bugs or security vulnerabilities detected.
              </div>
            ) : (
              reviewReport.issues.map((issue: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg border border-[#D4AF37]/25 bg-[#0A0A0A] flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#FFFFFF]">
                      Line {issue.affected_line}: {issue.issue_description}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        issue.severity === "critical" || issue.severity === "high"
                          ? "bg-[#B22222]/15 text-[#B22222] border border-[#B22222]"
                          : "bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/50"
                      }`}
                    >
                      {issue.severity}
                    </span>
                  </div>
                  <p className="text-xs text-[#BDBDBD]">{issue.explanation}</p>
                  <p className="text-xs text-[#D4AF37]">
                    <span className="font-semibold text-[#FFFFFF]">Fix:</span>{" "}
                    {issue.suggested_correction}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
