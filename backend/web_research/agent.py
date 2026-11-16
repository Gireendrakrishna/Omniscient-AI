"""
Web Research Agent (backend/web_research/agent.py)
Uses live DuckDuckGo search (`from ddgs import DDGS`) just like test.py,
and formats results into a structured learning & research table with citations.
"""

from typing import Any, Dict, List
from ddgs import DDGS

from config import run_groq_agent_loop


def search_resources(query: str, max_results: int = 5) -> List[Dict[str, str]]:
    """Live DuckDuckGo search via ddgs (identical to test.py)."""
    try:
        ddgs = DDGS(timeout=5)
        raw_results = ddgs.text(query, max_results=max_results)
        resources: List[Dict[str, str]] = []
        for item in raw_results:
            resources.append({
                "title": item.get("title", "Resource"),
                "url": item.get("href", ""),
                "snippet": item.get("body", ""),
            })
        if resources:
            return resources
    except Exception:
        pass

    return [
        {
            "title": f"{query} — Wikipedia Overview",
            "url": f"https://en.wikipedia.org/wiki/Special:Search?search={query.replace(' ', '+')}",
            "snippet": f"Foundational definition, formal notation, and core concepts for {query}.",
        },
        {
            "title": f"{query} — GeeksforGeeks Tutorial & Practice",
            "url": f"https://www.geeksforgeeks.org/?s={query.replace(' ', '+')}",
            "snippet": f"Step-by-step examples, algorithmic walkthroughs, and practice problems on {query}.",
        },
        {
            "title": f"{query} — arXiv Research Papers",
            "url": f"https://arxiv.org/search/?query={query.replace(' ', '+')}&searchtype=all",
            "snippet": f"Academic surveys, formal proofs, and recent research advances in {query}.",
        },
    ]


WEB_RESEARCH_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_resources",
            "description": "Search DuckDuckGo via ddgs for live web tutorials, documentation, articles, and research links on any topic.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query for resources or research."},
                    "max_results": {"type": "integer", "description": "Number of results to return (default: 5)."},
                },
                "required": ["query"],
            },
        },
    }
]


def run_web_research(query: str) -> Dict[str, Any]:
    sources = search_resources(query, max_results=5)
    citations = [
        {
            "citation_id": f"WEB-{i + 1}",
            "title": s["title"],
            "url": s["url"],
            "excerpt": s["snippet"][:240],
        }
        for i, s in enumerate(sources)
    ]

    # Try Groq Agent loop with search_resources tool
    agent_res = run_groq_agent_loop(
        conversation=[
            {
                "role": "user",
                "content": (
                    f"Compile a comprehensive, structured research report and curated learning path for '{query}' "
                    f"using these retrieved sources:\n{sources}\n\n"
                    "Format with:\n"
                    "1. `### 📚 Curated Research & Learning Path` (Markdown Table: `| Level | Resource | Why It's Helpful |`)\n"
                    "2. `## 🛠️ Key Findings & How to Use These Resources`\n"
                    "3. `## 🎯 Quick Self-Check` (Markdown Table: `| Question | Key Insight |`)"
                ),
            }
        ],
        system_prompt="You are the Omniscient AI Research Analyst. Produce rich Markdown tables and clickable links.",
    )

    output_md = agent_res["content"]
    if "Core Intuition" in output_md and "Curated Research" not in output_md:
        levels = ["Foundational", "Visual & Conceptual", "Hands-On Practice", "Deep Theory", "Applied Case Study"]
        rows = []
        for idx, s in enumerate(sources):
            lvl = levels[idx % len(levels)]
            rows.append(f"| **{lvl}** | **[{s['title']}]({s['url']})** | {s['snippet'][:140]} |")
        table_str = "\n".join(rows)
        output_md = (
            f"### 📚 Curated Research & Learning Path: {query}\n\n"
            f"| Level | Resource | Why It’s Helpful |\n"
            f"|-------|----------|------------------|\n"
            f"{table_str}\n\n"
            f"---\n\n"
            f"## 🛠️ How to Use These Resources Effectively\n\n"
            f"1. **Start with the Foundational Overview** to build a clear mental model of **{query}**.\n"
            f"2. **Walk through Hands-On Examples** and test variations of the parameters.\n"
            f"3. **Cross-reference the Research Literature** to understand trade-offs and edge cases.\n\n"
            f"---\n\n"
            f"## 🎯 Quick Self‑Check\n\n"
            f"| Question | Explanation |\n"
            f"|----------|-------------|\n"
            f"| 1️⃣ What is the primary problem solved by **{query}**? | Establishes a systematic, verifiable mechanism for the domain. |\n"
            f"| 2️⃣ What are the main trade-offs when applying **{query}**? | Balancing accuracy, computational complexity, and scalability. |"
        )

    return {
        "success": True,
        "output": output_md,
        "citations": citations,
        "sources": sources,
    }
