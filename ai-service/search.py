from duckduckgo_search import DDGS
import requests
from bs4 import BeautifulSoup


class WebSearch:
    def search(self, query, max_results=4):
        try:
            print(f"[SEARCH] {query}")
            with DDGS(timeout=4, verify=False) as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
            formatted = [
                {
                    "title": r.get("title", ""),
                    "snippet": r.get("body", ""),
                    "url": r.get("href", ""),
                }
                for r in results
            ]
            print(f"[SEARCH] Got {len(formatted)} results")
            return formatted
        except Exception as e:
            print(f"[SEARCH ERROR] {e}")
            return []

    def format_for_prompt(self, results):
        if not results:
            return "No search results available."
        lines = ["REAL INTERNET DATA:"]
        for i, r in enumerate(results, 1):
            lines.append(f"[{i}] {r['title']}")
            lines.append(f"    {r['snippet']}")
            lines.append(f"    Source: {r['url']}")
        return "\n".join(lines)

    def collect_sources(self, results, agent_name):
        return [
            {"agent": agent_name, "title": r["title"], "url": r["url"]}
            for r in results
            if r.get("url")
        ]
