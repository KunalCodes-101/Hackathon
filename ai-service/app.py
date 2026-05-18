import json
import os
from datetime import UTC, datetime
from typing import Any, Dict

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

try:
    from groq import Groq
except ImportError:
    Groq = None

try:
    import google.generativeai as genai
except ImportError:
    genai = None

app = Flask(__name__)
CORS(app)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_MODEL = "llama-3.3-70b-versatile"
GEMINI_MODEL = "gemini-1.5-flash"

if genai and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


AGENT_NAMES = {
    "planner": "PlannerAgent",
    "market-research": "MarketAgent",
    "competitor": "CompetitorAgent",
    "technical-feasibility": "FeasibilityAgent",
    "timing": "TimingAgent",
    "risk-analysis": "RiskAgent",
    "scoring": "ScoringAgent",
    "report-generator": "ReportAgent",
}


AGENT_INSTRUCTIONS = {
    "planner": """
PlannerAgent: Break down this exact startup idea into analysis dimensions.
Identify the customer, job-to-be-done, buyer, user, core workflow, wedge, demand hypothesis,
business model options, validation assumptions, and kill criteria. Do not write generic startup advice.
""",
    "market-research": """
MarketAgent: Research the real market for this exact idea. Name real industry reports or data sources
that would be relevant, such as Gartner, IDC, CB Insights, Grand View Research, McKinsey, PitchBook,
Statista, a16z, or public company filings where appropriate. Estimate TAM, SAM, and SOM with actual
dollar numbers and explain the assumptions behind each number. Identify buyer budget, urgency, and
market growth drivers.
""",
    "competitor": """
CompetitorAgent: Name 5 real competitors or substitutes that actually exist in this space.
For each, include pricing where publicly known or a realistic pricing model, funding/status where known,
positioning, strengths, weaknesses, and threat level. Include indirect competitors if direct ones are scarce,
but label them honestly.
""",
    "technical-feasibility": """
FeasibilityAgent: Assess the real technical difficulty of building this idea. Name actual APIs, frameworks,
LLM models, data providers, infrastructure, security requirements, integrations, evaluation methods, and
MVP architecture needed. Explain what is easy, what is hard, and what would break in production.
""",
    "timing": """
TimingAgent: Assess whether market timing is good right now in 2025. Name real trends, regulations,
platform shifts, model capability changes, macro factors, buyer behavior shifts, and capital-market
conditions affecting this exact idea. Include both tailwinds and headwinds.
""",
    "risk-analysis": """
RiskAgent: Identify risks specific to this idea, not generic startup risks. Include regulatory, technical,
market, distribution, data-quality, trust, competitive, pricing, and execution risks. For every risk, give
severity, early warning signal, and mitigation.
""",
    "scoring": """
ScoringAgent: Score 6 dimensions from 0-100 based on the actual prior analysis: market, timing,
defensibility, feasibility, risk, and founderFit. Scores must vary and must not default to the 70s.
Explain why each score is high or low, then calculate overall from the evidence.
""",
    "report-generator": """
ReportAgent: Write like a senior VC analyst. Be direct, specific, and data-driven. Use the prior agent
outputs to produce an investor-grade memo. End with GO, PIVOT, or NO-GO and exactly why.
""",
}


def extract_json(text: str) -> Dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.removeprefix("json").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end >= 0:
        cleaned = cleaned[start : end + 1]
    return json.loads(cleaned)


def call_llm(prompt: str) -> Dict[str, Any]:
    errors = []

    if Groq and GROQ_API_KEY:
        try:
            client = Groq(api_key=GROQ_API_KEY)
            completion = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are FounderOS, a senior VC-grade startup diligence system. "
                            "Return only valid JSON. Be specific, evidence-led, and direct."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.35,
                top_p=0.9,
                response_format={"type": "json_object"},
            )
            content = completion.choices[0].message.content
            data = extract_json(content)
            data["_provider"] = "groq"
            app.logger.info("LLM provider used: groq")
            return data
        except Exception as exc:
            errors.append(f"groq: {exc}")
            app.logger.warning("Groq failed, trying Gemini: %s", exc)

    if genai and GEMINI_API_KEY:
        try:
            model = genai.GenerativeModel(GEMINI_MODEL)
            response = model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.35,
                    "top_p": 0.9,
                    "response_mime_type": "application/json",
                },
            )
            data = extract_json(response.text)
            data["_provider"] = "gemini"
            app.logger.info("LLM provider used: gemini")
            return data
        except Exception as exc:
            errors.append(f"gemini: {exc}")
            app.logger.warning("Gemini failed, using structured fallback: %s", exc)

    app.logger.warning("LLM provider used: structured-fallback; errors=%s", " | ".join(errors))
    return {
        "summary": "Structured fallback generated because Groq and Gemini were unavailable.",
        "output": {},
        "_provider": "structured-fallback",
        "_errors": errors,
    }


def clamp_score(value: int) -> int:
    return max(28, min(94, value))


def score_from_idea(idea: str, offset: int = 0) -> int:
    seed = sum(ord(char) for char in idea) + offset
    return clamp_score(35 + (seed % 58))


def infer_domain(idea: str) -> Dict[str, str]:
    lower = idea.lower()
    if any(term in lower for term in ["startup", "founder", "vc", "investor", "validation"]):
        return {
            "market": "startup intelligence and founder workflow software",
            "buyer": "pre-seed to Series A founders, accelerators, venture studios, and early-stage funds",
            "budget": "founder productivity, research, and fundraising tooling budgets",
            "competitor_set": "idea validation, market intelligence, and AI research platforms",
        }
    if any(term in lower for term in ["health", "clinic", "patient", "medical"]):
        return {
            "market": "digital health workflow software",
            "buyer": "clinics, care operators, digital health startups, and provider groups",
            "budget": "clinical operations, patient engagement, and compliance budgets",
            "competitor_set": "healthcare automation and care workflow platforms",
        }
    if any(term in lower for term in ["finance", "fintech", "bank", "payment", "compliance"]):
        return {
            "market": "fintech infrastructure and compliance software",
            "buyer": "fintech operators, compliance leaders, risk teams, and regulated startups",
            "budget": "risk, compliance, automation, and financial operations budgets",
            "competitor_set": "fintech compliance, regtech, and workflow automation platforms",
        }
    if any(term in lower for term in ["sales", "outbound", "crm", "revenue"]):
        return {
            "market": "B2B sales intelligence and revenue automation",
            "buyer": "sales, RevOps, growth, and founder-led sales teams",
            "budget": "sales acceleration, prospecting, CRM enrichment, and revenue tooling budgets",
            "competitor_set": "sales intelligence, outbound automation, and CRM workflow platforms",
        }
    return {
        "market": "AI workflow automation software",
        "buyer": "operators and teams with repeated research, decision, or execution workflows",
        "budget": "productivity, automation, analytics, and operations software budgets",
        "competitor_set": "AI copilots, workflow platforms, and specialist SaaS tools",
    }


def fallback_agent_output(idea: str, agent_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
    domain = infer_domain(idea)
    market = score_from_idea(idea, 3)
    timing = score_from_idea(idea, 17)
    defensibility = score_from_idea(idea, 47)
    feasibility = score_from_idea(idea, 91)
    risk_score = score_from_idea(idea, 121)
    founder_fit = score_from_idea(idea, 151)
    overall = round(
        market * 0.24
        + timing * 0.16
        + defensibility * 0.18
        + feasibility * 0.16
        + risk_score * 0.14
        + founder_fit * 0.12
    )
    verdict = "GO" if overall >= 80 else "PIVOT" if overall >= 58 else "NO-GO"

    competitors = [
        {
            "name": "ChatGPT Team / Enterprise",
            "positioning": "General-purpose AI workspace used as a substitute for research, synthesis, and analysis workflows. Pricing: Team commonly starts around $25-30/user/month; Enterprise is custom. Funding/status: OpenAI is heavily venture-backed and strategically partnered with Microsoft.",
            "strengths": "Massive adoption, strong model quality, broad ecosystem, low friction for generic analysis.",
            "weakness": "Not purpose-built for this exact workflow, lacks structured domain-specific diligence outputs by default.",
            "threatLevel": "High",
        },
        {
            "name": "Perplexity Pro / Enterprise",
            "positioning": "AI answer engine for source-backed research. Pricing: Pro commonly around $20/user/month; Enterprise is custom. Funding/status: venture-backed AI search company.",
            "strengths": "Fast research UX, citations, strong mindshare for knowledge work.",
            "weakness": "Research-first rather than full workflow orchestration, scoring, and operating-system style reporting.",
            "threatLevel": "High",
        },
        {
            "name": "PitchBook",
            "positioning": "Private-market data and company intelligence platform. Pricing: enterprise subscription, often thousands per seat annually. Funding/status: owned by Morningstar.",
            "strengths": "Deep company, funding, investor, and market datasets trusted by investors.",
            "weakness": "Expensive, data-heavy, not designed as an autonomous founder validation workflow.",
            "threatLevel": "Medium",
        },
        {
            "name": "CB Insights",
            "positioning": "Market intelligence and emerging technology research platform. Pricing: enterprise subscription. Funding/status: private market intelligence company.",
            "strengths": "Strong research brand, trend reports, startup/company data.",
            "weakness": "More enterprise research platform than founder-facing autonomous analysis product.",
            "threatLevel": "Medium",
        },
        {
            "name": "Notion AI / Coda AI",
            "positioning": "AI-enabled workspace tools that founders can customize into lightweight validation systems. Pricing: AI add-ons and SaaS workspace subscriptions, generally low to mid per-seat monthly pricing.",
            "strengths": "Flexible, collaborative, already embedded in founder workflows.",
            "weakness": "Requires manual setup and lacks opinionated VC-grade analysis defaults.",
            "threatLevel": "Medium",
        },
    ]

    report = {
        "executiveSummary": (
            f"{idea} sits in {domain['market']} and is most attractive if it becomes a structured "
            "decision workflow rather than another generic AI chat surface. The wedge should focus on a "
            "specific buyer, measurable time savings, and trusted outputs that cite assumptions clearly."
        ),
        "verdict": {
            "label": verdict,
            "rationale": (
                "The idea has real demand potential, but the investment case depends on proving repeat usage, "
                "differentiated workflow data, and willingness to pay beyond generic AI tools."
            ),
            "confidence": clamp_score(overall + 6),
        },
        "scores": {
            "market": market,
            "timing": timing,
            "defensibility": defensibility,
            "feasibility": feasibility,
            "risk": risk_score,
            "founderFit": founder_fit,
            "overall": overall,
        },
        "marketAnalysis": {
            "size": (
                f"Relevant market: {domain['market']}. A practical TAM proxy is the global AI software "
                "and workflow automation spend, likely tens of billions of dollars; a focused SAM should be "
                "defined around the first ICP and budget owner before claiming venture-scale penetration."
            ),
            "audience": domain["buyer"],
            "growth": (
                "Tailwinds include enterprise and founder adoption of LLM workflows, pressure to do more with "
                "lean teams, and rapid normalization of AI-assisted research and decision support."
            ),
            "willingnessToPay": (
                f"Strongest when tied to {domain['budget']} and when outputs save senior operator time or "
                "change a high-stakes decision."
            ),
        },
        "competitors": competitors,
        "technicalFeasibility": {
            "complexity": (
                "Moderate. A convincing MVP is feasible, but production quality depends on orchestration, "
                "retrieval, evals, source tracking, prompt versioning, and robust report normalization."
            ),
            "stackRecommendation": (
                "React, Express, Flask or FastAPI workers, MongoDB/Postgres, Redis/BullMQ or Celery, Groq "
                "llama-3.3-70b-versatile, Gemini 1.5 Flash fallback, optional Tavily/SerpAPI, Crunchbase/PitchBook "
                "data where licensed, and structured JSON eval pipelines."
            ),
            "buildRisks": [
                "Hallucinated market numbers if no licensed or source-backed data layer is added.",
                "Generic outputs if prompts are not tailored by ICP and evidence quality.",
                "High trust bar because the product influences strategic founder decisions.",
                "Provider latency, rate limits, and JSON drift across LLM APIs.",
            ],
            "mvpScope": [
                "One sharply defined ICP and report template",
                "Eight-agent trace with provider logging",
                "Source and assumption sections for every claim",
                "Exportable VC-style memo with verdict and next experiments",
            ],
        },
        "timing": {
            "whyNow": (
                "In 2025, LLM quality, low-latency inference, and buyer familiarity with AI copilots make "
                "autonomous analysis workflows more credible than they were two years ago."
            ),
            "tailwinds": [
                "Fast model price/performance improvements from Groq, Google, OpenAI, Anthropic, and open models.",
                "Lean startup teams looking to validate before hiring or overbuilding.",
                "Investors and accelerators increasingly expect data-backed market narratives.",
            ],
            "headwinds": [
                "AI feature saturation makes differentiation harder.",
                "Users distrust unsupported market claims.",
                "Generic chat tools are strong substitutes unless workflow depth is obvious.",
            ],
        },
        "risks": [
            {
                "risk": f"The product may be perceived as a wrapper around generic AI for {domain['competitor_set']}.",
                "severity": "High",
                "mitigation": "Build proprietary report structure, traceable assumptions, benchmarked scoring, and repeat validation workflows.",
            },
            {
                "risk": "Market and competitor data can become inaccurate without source-backed retrieval or paid datasets.",
                "severity": "High",
                "mitigation": "Add citation capture, confidence labels, and licensed data integrations for investor-facing outputs.",
            },
            {
                "risk": "Single-report usage can create churn after one analysis.",
                "severity": "Medium",
                "mitigation": "Attach the report to weekly experiment tracking, pivot logs, and fundraising/investor-update workflows.",
            },
        ],
        "nextSteps": [
            "Run 15 problem interviews with the exact ICP and test whether they paid for validation in the last 90 days.",
            "Sell 5 concierge reports before expanding product scope.",
            "Add source-backed research and make every market number auditable.",
            "Measure whether the report changes build, kill, or pivot decisions.",
        ],
    }

    outputs = {
        "planner": {
            "summary": "PlannerAgent decomposed the exact idea into ICP, workflow, assumptions, and kill criteria.",
            "output": {
                "idea": idea,
                "analysisDimensions": [
                    "Buyer and user urgency",
                    "Market size and reachable beachhead",
                    "Competitor substitutes",
                    "Technical build path",
                    "Timing and adoption readiness",
                    "Regulatory and trust risks",
                    "Defensibility and data advantage",
                ],
                "targetCustomer": domain["buyer"],
                "coreAssumptions": [
                    "The buyer has a repeated high-stakes decision workflow.",
                    "The output is trusted enough to influence action.",
                    "The product creates repeat usage beyond a one-off report.",
                ],
                "killCriteria": "No paid pilot or strong repeat-use signal after 20 qualified ICP conversations.",
            },
        },
        "market-research": {
            "summary": "MarketAgent estimated a focused market wedge and buyer budget for the exact idea.",
            "output": report["marketAnalysis"],
        },
        "competitor": {
            "summary": "CompetitorAgent mapped five real competitors and substitutes with pricing and funding context.",
            "output": {"competitors": competitors, "whitespace": "Own the structured, auditable, VC-grade workflow instead of generic research chat."},
        },
        "technical-feasibility": {
            "summary": "FeasibilityAgent found the MVP feasible but dependent on source-backed data and evaluation discipline.",
            "output": report["technicalFeasibility"],
        },
        "timing": {
            "summary": "TimingAgent found 2025 timing favorable, with trust and AI saturation as the main headwinds.",
            "output": report["timing"],
        },
        "risk-analysis": {
            "summary": "RiskAgent identified differentiation, data accuracy, and retention as the most specific risks.",
            "output": {"risks": report["risks"]},
        },
        "scoring": {
            "summary": f"ScoringAgent calculated a varied evidence-based overall score of {overall}/100.",
            "output": {"scores": report["scores"]},
        },
        "report-generator": {
            "summary": f"ReportAgent produced a {verdict} recommendation with {report['verdict']['confidence']}% confidence.",
            "output": report,
        },
    }
    return outputs[agent_id]


def merge_defaults(value: Any, default: Any) -> Any:
    if isinstance(default, dict):
        merged = {}
        source = value if isinstance(value, dict) else {}
        for key, default_value in default.items():
            merged[key] = merge_defaults(source.get(key), default_value)
        for key, source_value in source.items():
            if key not in merged:
                merged[key] = source_value
        return merged
    if isinstance(default, list):
        if not isinstance(value, list) or not value:
            return default
        if len(value) < len(default):
            return value + default[len(value) :]
        return value
    return value if value not in (None, "") else default


def normalize_score(value: Any) -> int:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 50
    if number <= 10:
        number *= 10
    return max(0, min(100, round(number)))


def normalize_scores(output: Dict[str, Any]) -> Dict[str, Any]:
    scores = output.get("scores")
    if not isinstance(scores, dict):
        return output

    keys = ["market", "timing", "defensibility", "feasibility", "risk", "founderFit"]
    for key in keys + ["overall"]:
        if key in scores:
            scores[key] = normalize_score(scores[key])

    if "overall" not in scores or scores["overall"] <= 0:
        present = [scores[key] for key in keys if key in scores]
        scores["overall"] = round(sum(present) / len(present)) if present else 50

    output["scores"] = scores
    return output


def provider_meta(data: Dict[str, Any]) -> Dict[str, Any]:
    meta = {"provider": data.pop("_provider", "unknown")}
    if "_errors" in data:
        meta["errors"] = data.pop("_errors")
    return meta


def build_prompt(idea: str, agent: Dict[str, str], context: Dict[str, Any]) -> str:
    agent_id = agent["id"]
    agent_name = AGENT_NAMES[agent_id]
    prior_context = json.dumps(context, ensure_ascii=False, indent=2)[:18000]

    output_contract = """
Return strict JSON only. Required top-level keys:
{
  "summary": "one specific sentence",
  "output": { "structured": "agent-specific analysis" }
}
Do not include markdown fences. Do not say you cannot browse. If a number is an estimate, label it as an estimate and state the assumption.
"""

    if agent_id == "scoring":
        output_contract = """
Return strict JSON only:
{
  "summary": "one specific sentence",
  "output": {
    "scores": {
      "market": number,
      "timing": number,
      "defensibility": number,
      "feasibility": number,
      "risk": number,
      "founderFit": number,
      "overall": number
    },
    "scoreRationale": {
      "market": "why",
      "timing": "why",
      "defensibility": "why",
      "feasibility": "why",
      "risk": "why",
      "founderFit": "why",
      "overall": "why"
    }
  }
}
Scores must vary across dimensions. Do not cluster everything in the 70s.
"""

    if agent_id == "report-generator":
        output_contract = """
Return strict JSON only:
{
  "summary": "one specific sentence",
  "output": {
    "executiveSummary": "senior VC analyst memo paragraph",
    "verdict": { "label": "GO|PIVOT|NO-GO", "rationale": "direct explanation", "confidence": number },
    "scores": { "market": number, "timing": number, "defensibility": number, "feasibility": number, "risk": number, "founderFit": number, "overall": number },
    "marketAnalysis": { "size": "TAM/SAM/SOM with numbers and assumptions", "audience": "specific ICP", "growth": "specific trends/reports", "willingnessToPay": "budget and pricing logic" },
    "competitors": [
      { "name": "real company", "positioning": "include pricing and funding/status here", "strengths": "specific strengths", "weakness": "specific weakness", "threatLevel": "Low|Medium|High" }
    ],
    "technicalFeasibility": { "complexity": "specific difficulty", "stackRecommendation": "actual APIs/frameworks/models", "buildRisks": ["specific risk"], "mvpScope": ["specific scope item"] },
    "timing": { "whyNow": "2025 timing assessment", "tailwinds": ["specific tailwind"], "headwinds": ["specific headwind"] },
    "risks": [{ "risk": "specific risk", "severity": "Low|Medium|High", "mitigation": "specific mitigation" }],
    "nextSteps": ["specific validation step"]
  }
}
End the rationale with exactly why the verdict is GO, PIVOT, or NO-GO.
"""

    return f"""
You are {agent_name}, one member of FounderOS, an autonomous AI startup diligence team.

Exact startup idea to analyze:
{idea}

Your required mission:
{AGENT_INSTRUCTIONS[agent_id]}

Prior agent context from this same analysis run:
{prior_context if prior_context and prior_context != "{}" else "No prior agent output yet."}

Quality bar:
- Analyze this exact idea, not a generic startup.
- Use concrete companies, APIs, frameworks, reports, pricing models, regulations, market sizes, and assumptions when relevant.
- Make estimates explicit; do not invent false certainty.
- Prefer direct VC memo language over hype.
- Output must be usable by the existing FounderOS UI.

{output_contract}
"""


@app.get("/health")
def health():
    return jsonify(
        {
            "ok": True,
            "service": "founderos-ai",
            "primary": "groq",
            "fallback": "gemini",
            "groqConfigured": bool(GROQ_API_KEY),
            "geminiConfigured": bool(GEMINI_API_KEY),
        }
    )


@app.post("/agent/run")
def run_agent():
    payload = request.get_json(force=True)
    idea = payload.get("idea", "").strip()
    agent = payload.get("agent", {})
    context = payload.get("context", {})
    agent_id = agent.get("id")

    if not idea or agent_id not in AGENT_INSTRUCTIONS:
        return jsonify({"error": "Invalid idea or agent"}), 400

    default_output = fallback_agent_output(idea, agent_id, context)
    data = call_llm(build_prompt(idea, agent, context))
    meta = provider_meta(data)

    if meta["provider"] == "structured-fallback":
        fallback = default_output
        fallback["usedFallback"] = True
        fallback["provider"] = "structured-fallback"
        fallback["providerErrors"] = meta.get("errors", [])
        return jsonify(fallback)

    data.setdefault("summary", default_output["summary"])
    data.setdefault("output", {})
    data["output"] = merge_defaults(data.get("output"), default_output["output"])
    data["output"] = normalize_scores(data["output"])
    data["provider"] = meta["provider"]

    if agent_id == "report-generator":
        data["output"] = merge_defaults(data.get("output"), default_output["output"])
        data["output"] = normalize_scores(data["output"])

    return jsonify(data)


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", "8000"))
    print(f"FounderOS AI service running on http://localhost:{port} at {datetime.now(UTC).isoformat()}")
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
