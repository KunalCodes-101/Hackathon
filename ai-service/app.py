import json
import os
from datetime import datetime, UTC
from typing import Any, Dict

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

try:
    import google.generativeai as genai
except ImportError:
    genai = None

app = Flask(__name__)
CORS(app)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemini-1.5-flash"

if genai and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


AGENT_PROMPTS = {
    "planner": "Create a validation strategy, target customer hypothesis, key assumptions, and kill criteria.",
    "market-research": "Assess market category, ICP, pain intensity, budget owner, TAM/SAM/SOM, and willingness to pay.",
    "competitor": "Identify direct competitors, indirect alternatives, substitutes, strengths, weaknesses, and whitespace.",
    "technical-feasibility": "Evaluate technical complexity, architecture, data dependencies, integrations, MVP scope, and build risks.",
    "timing": "Analyze why-now signals, macro tailwinds, adoption readiness, regulatory changes, and counter-timing risks.",
    "risk-analysis": "Identify the highest leverage strategic, execution, trust, legal, and distribution risks with mitigations.",
    "scoring": "Score market, timing, defensibility, feasibility, risk, founder fit, and overall opportunity quality.",
    "report-generator": "Produce the final investor-grade report with scores, competitors, risks, market analysis, and verdict.",
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


def gemini_json(prompt: str) -> Dict[str, Any]:
    if not genai or not GEMINI_API_KEY:
        raise RuntimeError("Gemini is not configured")

    model = genai.GenerativeModel(MODEL_NAME)
    response = model.generate_content(
        prompt,
        generation_config={
            "temperature": 0.55,
            "top_p": 0.9,
            "response_mime_type": "application/json",
        },
    )
    return extract_json(response.text)


def score_from_idea(idea: str, offset: int = 0) -> int:
    seed = sum(ord(char) for char in idea) + offset
    return 58 + (seed % 34)


def fallback_agent_output(idea: str, agent_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
    market = score_from_idea(idea, 3)
    timing = score_from_idea(idea, 17)
    defensibility = score_from_idea(idea, 29)
    feasibility = score_from_idea(idea, 43)
    risk_score = score_from_idea(idea, 61)
    founder_fit = score_from_idea(idea, 79)
    overall = round((market + timing + defensibility + feasibility + risk_score + founder_fit) / 6)

    report = {
        "executiveSummary": (
            f"{idea} shows a credible wedge if the founding team can prove urgent demand, "
            "compress onboarding friction, and create a repeatable acquisition loop before scaling."
        ),
        "verdict": {
            "label": "GO" if overall >= 78 else "PIVOT" if overall >= 64 else "NO-GO",
            "rationale": "The opportunity has enough signal to validate, but investor readiness depends on proof of demand and differentiated distribution.",
            "confidence": min(92, max(62, overall + 4)),
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
            "size": "Large enough for venture validation if focused on a painful, budgeted beachhead.",
            "audience": "Early adopters are likely operators or founders with visible workflow pain and low tolerance for manual coordination.",
            "growth": "AI-native workflow adoption and tighter capital efficiency expectations create a durable pull.",
            "willingnessToPay": "Highest where the product saves senior time, reduces churn, or improves revenue conversion.",
        },
        "competitors": [
            {
                "name": "Incumbent workflow suites",
                "positioning": "Broad platforms that bundle adjacent workflows.",
                "strengths": "Distribution, integrations, procurement trust.",
                "weakness": "Slow product velocity and generic AI experiences.",
                "threatLevel": "High",
            },
            {
                "name": "Vertical AI copilots",
                "positioning": "Narrow tools solving one job deeply.",
                "strengths": "Sharp UX and fast perceived value.",
                "weakness": "Limited data moat and shallow expansion paths.",
                "threatLevel": "Medium",
            },
            {
                "name": "Manual services and agencies",
                "positioning": "Human-led alternatives with custom output.",
                "strengths": "Trust, flexibility, consultative delivery.",
                "weakness": "Expensive, slow, and difficult to scale.",
                "threatLevel": "Medium",
            },
        ],
        "technicalFeasibility": {
            "complexity": "Moderate to high; the MVP is feasible if scoped around one workflow and measured output quality.",
            "stackRecommendation": "React, Node/Express, Python AI workers, MongoDB, queue-backed agent orchestration, and evaluation traces.",
            "buildRisks": [
                "LLM output quality may vary without strong prompts and evaluation harnesses.",
                "Real-time orchestration can become brittle without resumable job state.",
                "Data integrations may dominate MVP complexity.",
            ],
            "mvpScope": [
                "Single ICP onboarding path",
                "One high-frequency workflow",
                "Agent trace viewer",
                "Exportable investor-grade report",
            ],
        },
        "timing": {
            "whyNow": "AI models are good enough to automate research synthesis while founders are aggressively seeking faster validation loops.",
            "tailwinds": [
                "LLM adoption in professional workflows",
                "Pressure to validate before hiring or building",
                "Cheaper prototyping infrastructure",
            ],
            "headwinds": [
                "AI feature fatigue",
                "Trust gaps around automated recommendations",
                "Potential API cost sensitivity",
            ],
        },
        "risks": [
            {
                "risk": "Weak differentiation versus generic AI chat workflows.",
                "severity": "High",
                "mitigation": "Own a structured, repeatable report format and benchmark quality against investor diligence criteria.",
            },
            {
                "risk": "Founders may churn after a single report.",
                "severity": "Medium",
                "mitigation": "Build ongoing validation loops, weekly experiment tracking, and investor update exports.",
            },
            {
                "risk": "Research accuracy can be challenged.",
                "severity": "High",
                "mitigation": "Show evidence trails, confidence levels, and explicit assumptions in every report.",
            },
        ],
        "nextSteps": [
            "Interview 15 founders who recently killed or pivoted an idea.",
            "Ship a concierge MVP that produces reports in under 10 minutes.",
            "Measure whether users change decisions after reading the report.",
            "Add source-backed research once the report structure proves valuable.",
        ],
    }

    outputs = {
        "planner": {
            "summary": "Validation plan built around assumptions, ICP, and kill criteria.",
            "output": {
                "hypothesis": f"{idea} wins if it turns a costly, repeated founder workflow into a trusted decision system.",
                "targetCustomer": "Seed-stage founders and operators evaluating new product bets.",
                "assumptions": [
                    "The pain is frequent enough to justify workflow adoption.",
                    "Users trust AI analysis when it exposes reasoning and confidence.",
                    "The report saves enough time to become a repeat purchase.",
                ],
                "validationPlan": [
                    "Run problem interviews",
                    "Sell a manual report",
                    "Track decision impact",
                    "Automate the highest-friction research steps",
                ],
                "killCriteria": "No paid demand after 20 qualified founder conversations.",
            },
        },
        "market-research": {
            "summary": "Market signal is strongest around time savings and better startup decision quality.",
            "output": report["marketAnalysis"],
        },
        "competitor": {
            "summary": "Competitive pressure is real, but a structured diligence workflow creates whitespace.",
            "output": {"competitors": report["competitors"], "whitespace": "Own the end-to-end validation report rather than generic chat."},
        },
        "technical-feasibility": {
            "summary": "MVP is feasible with scoped agents and persistent orchestration traces.",
            "output": report["technicalFeasibility"],
        },
        "timing": {
            "summary": "Timing is favorable because founders need faster validation under tighter capital markets.",
            "output": report["timing"],
        },
        "risk-analysis": {
            "summary": "Trust, differentiation, and retention are the core risks to manage.",
            "output": {"risks": report["risks"]},
        },
        "scoring": {
            "summary": f"Overall opportunity score calculated at {overall}/100.",
            "output": {"scores": report["scores"]},
        },
        "report-generator": {
            "summary": f"Final verdict: {report['verdict']['label']} with {report['verdict']['confidence']}% confidence.",
            "output": report,
        },
    }
    return outputs[agent_id]


def build_prompt(idea: str, agent: Dict[str, str], context: Dict[str, Any]) -> str:
    agent_id = agent["id"]
    required = (
        "Return strict JSON with keys summary and output. "
        "summary must be one sentence. output must be structured, specific, and investor-grade."
    )
    if agent_id == "report-generator":
        required = """
Return strict JSON with keys summary and output. output must exactly include:
executiveSummary, verdict { label GO|PIVOT|NO-GO, rationale, confidence },
scores { market, timing, defensibility, feasibility, risk, founderFit, overall },
marketAnalysis { size, audience, growth, willingnessToPay },
competitors array of { name, positioning, strengths, weakness, threatLevel },
technicalFeasibility { complexity, stackRecommendation, buildRisks array, mvpScope array },
timing { whyNow, tailwinds array, headwinds array },
risks array of { risk, severity, mitigation },
nextSteps array.
"""
    return f"""
You are FounderOS, an autonomous AI diligence team for startup validation.
Startup idea: {idea}
Current agent: {agent['name']}
Agent mission: {AGENT_PROMPTS[agent_id]}
Prior agent context: {json.dumps(context, ensure_ascii=False)[:12000]}
{required}
Be concrete. Avoid generic caveats. Use numbers from 0-100 for scores.
"""


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
        return value if isinstance(value, list) and value else default
    return value if value not in (None, "") else default


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "founderos-ai", "gemini": bool(GEMINI_API_KEY)})


@app.post("/agent/run")
def run_agent():
    payload = request.get_json(force=True)
    idea = payload.get("idea", "").strip()
    agent = payload.get("agent", {})
    context = payload.get("context", {})
    agent_id = agent.get("id")

    if not idea or agent_id not in AGENT_PROMPTS:
        return jsonify({"error": "Invalid idea or agent"}), 400

    try:
        data = gemini_json(build_prompt(idea, agent, context))
        data.setdefault("summary", f"{agent.get('name', 'Agent')} completed")
        data.setdefault("output", {})
        if agent_id == "report-generator":
            default_report = fallback_agent_output(idea, agent_id, context)["output"]
            data["output"] = merge_defaults(data.get("output"), default_report)
        return jsonify(data)
    except Exception as exc:
        fallback = fallback_agent_output(idea, agent_id, context)
        fallback["usedFallback"] = True
        fallback["fallbackReason"] = str(exc)
        return jsonify(fallback)


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", "8000"))
    print(f"FounderOS AI service running on http://localhost:{port} at {datetime.now(UTC).isoformat()}")
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
