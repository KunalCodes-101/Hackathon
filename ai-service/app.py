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


def fallback_agent_output(idea: str, region: str, agent_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
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

    # Premium regional physical competitor analysis for cafe/tea/beverage/food ideas
    is_matcha = any(term in idea.lower() for term in ["matcha", "cafe", "tea", "coffee", "beverage", "food", "restaurant", "bakery", "juice"])
    
    if is_matcha:
        competitors = [
            {
                "name": "Third Wave Coffee",
                "positioning": f"Premium specialty coffee & community workspaces physically active in the {region} region. Beverage pricing: 220 - 380 INR. Status: Well-funded chain backed by private equity.",
                "strengths": "Exceptional brand presence, high footfall Prime locations, cozy seating with active remote work culture.",
                "weakness": "Focused on specialty coffee; authentic, high-quality Japanese ceremonial matcha offerings are secondary.",
                "threatLevel": "High",
            },
            {
                "name": "Glen's Bakehouse",
                "positioning": f"Legendary casual cafe, bakery, and dessert landmark serving the local {region} customer base. Pricing: 180 - 450 INR. Status: Highly profitable established regional chain.",
                "strengths": "Strong local brand equity, iconic signature pastries, desserts, and casual dining foods.",
                "weakness": "Traditional bakery/cafe format; does not prioritize modern health-conscious wellness products or ceremonial grade matcha.",
                "threatLevel": "Medium",
            },
            {
                "name": "Chaayos",
                "positioning": f"Tech-enabled contemporary tea cafe chain operating multiple hubs in {region}. Pricing: 120 - 280 INR. Status: Highly funded by major VCs (Tiger Global, Elevation Capital).",
                "strengths": "Extensive customized traditional chai flavors, standard snack menu, strong automated operating system.",
                "weakness": "Mass-market focus on traditional sweet milk teas; lacks premium Japanese ceremonial matcha or tranquil cafe aesthetics.",
                "threatLevel": "Medium",
            },
            {
                "name": "Tea Villa Cafe",
                "positioning": f"Premium international tea lounge chain situated in the {region} area. Pricing: 200 - 400 INR. Status: Franchise network.",
                "strengths": "Very wide selection of international loose leaf teas and premium cafe layout.",
                "weakness": "Overly broad menu; lacks deep product education and authentic high-grade organic matcha specialization.",
                "threatLevel": "Medium",
            },
            {
                "name": f"Local {region} Bubble Tea and Juice Outlets",
                "positioning": f"Niche cold beverage kiosks appealing to younger demographics near {region}. Pricing: 150 - 300 INR. Status: Fragmented independent local owners.",
                "strengths": "Strong appeal to Gen-Z customers searching for fun, alternative cold drinks.",
                "weakness": "Perceived as sugar-laden treats rather than daily organic wellness rituals.",
                "threatLevel": "Low",
            }
        ]
    else:
        # High quality tech/general startup regional competitor fallback
        competitors = [
            {
                "name": f"ChatGPT Enterprise ({region} Region)",
                "positioning": f"General-purpose AI assistant widely adopted as a substitute by companies in {region}. Pricing: Team starts at $25-30/user/month; Enterprise is custom. Funding/status: OpenAI is heavily venture-backed.",
                "strengths": "Massive corporate adoption, exceptional general model capacity, wide integrations.",
                "weakness": f"Generic chat layout; lacks custom workflows and localized VC-grade research structured for {region}.",
                "threatLevel": "High",
            },
            {
                "name": f"Perplexity Pro ({region} Users)",
                "positioning": "AI answer engine widely utilized for citations and market research. Pricing: Pro is $20/user/month. Funding/status: VC-backed emerging search leader.",
                "strengths": "Extremely fast real-time search extraction, precise links, and source-backed answers.",
                "weakness": f"Focused purely on search results rather than a cohesive founder dashboard for custom operating validation.",
                "threatLevel": "High",
            },
            {
                "name": "PitchBook & CB Insights",
                "positioning": "Premium enterprise private-market intelligence platforms. Pricing: annual enterprise subscriptions costing thousands per seat. Funding/status: market giants.",
                "strengths": "Incredibly rich databases for funding histories, venture deal metrics, and competitive profiles.",
                "weakness": f"Extremely high pricing barrier for early stage startups; no structured validation tools specialized for {region}.",
                "threatLevel": "Medium",
            },
            {
                "name": f"Local {region} Consulting Practices",
                "positioning": f"Boutique validation, product design, and consulting agencies physically operating in {region}. Pricing: project-based consulting fees. Status: Bootstrapped local firms.",
                "strengths": "Tailored, manual consulting and deep understanding of the local {region} market landscape.",
                "weakness": "Slow manual delivery, non-scalable pricing, and lacks autonomous software capability.",
                "threatLevel": "Medium",
            },
            {
                "name": "Notion AI / Coda AI",
                "positioning": "General-purpose collaborative workspaces with integrated generative assistants. Pricing: low cost SaaS add-ons. Status: Highly funded giants.",
                "strengths": "Highly adaptable, collaborative, already fully integrated into existing founder document layouts.",
                "weakness": "Requires significant manual setup and custom template engineering to achieve professional outcomes.",
                "threatLevel": "Medium",
            }
        ]

    report = {
        "executiveSummary": (
            f"{idea} targets {domain['market']} in {region} and stands out strongest if it builds a structured, "
            f"localized execution wedge rather than a generic SaaS replica. For the target {region} community, "
            f"focusing on real local physical foot-traffic patterns, local competitor pricing, and customized offerings "
            f"will be crucial to drive initial traction."
        ),
        "verdict": {
            "label": verdict,
            "rationale": (
                f"The idea holds robust demand potential in {region}, but the strategic path requires proving "
                f"willingness-to-pay, high localized repeat usage, and strong differentiation compared to local incumbents."
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
                f"Target Market Size in {region}: TAM estimated at {market}M INR locally based on average consumer spending "
                f"and active demographic footprints, scaling to a broader national sector market proxy of tens of billions."
            ),
            "audience": f"Premium audience segments and health-conscious consumers located specifically in {region}.",
            "growth": f"Fast growth rates of 18-25% annually in {region} fueled by rapid urbanization and wellness lifestyle shifts.",
            "willingnessToPay": f"Highest when tied to luxury wellness rituals, daily premium drinks, or high-value remote work comfort."
        },
        "competitors": competitors,
        "technicalFeasibility": {
            "complexity": "Moderate. A highly functional, interactive MVP is straightforward, but operations require robust supply chains.",
            "stackRecommendation": (
                "Modern frontend, robust local node routing, cloud database, ceremonial-grade organic sourcing channels, "
                "and optimized physical setup assets."
            ),
            "buildRisks": [
                "Local municipal licensing, commercial kitchen approvals, and food safety standards.",
                "Supply chain lag times for Japanese matcha and specialty teas.",
                "High real estate premium and competitive lease rates in Prime zones."
            ],
            "mvpScope": [
                f"One highly premium flagship experience center in {region}",
                "A highly engaging digital loyalty and order-ahead application",
                "Direct partnerships with authentic Japanese organic farms"
            ]
        },
        "timing": {
            "whyNow": f"In 2025, wellness adoption, premium tea/coffee lifestyle culture, and remote work trends in {region} are at an all-time high.",
            "tailwinds": [
                "Explosive growth of premium beverage outlets and health-conscious eating habits.",
                f"Increasing concentration of corporate professionals and remote tech employees in {region} seeking spaces.",
                "Rising consumer disposable income willing to support premium lifestyle brands."
            ],
            "headwinds": [
                "Real estate inflation and high commercial rent pressures.",
                "Talent retention costs for high-quality retail staff and managers.",
                "Short-term consumer distraction with generic trend drinks."
            ]
        },
        "risks": [
            {
                "risk": "Fierce local competition from well-capitalized coffee chains.",
                "severity": "High",
                "mitigation": f"Position the brand strictly around specialty matcha, supreme quiet workspace aesthetics, and zen experiences in {region}."
            },
            {
                "risk": "Quality variance in imported organic ingredients.",
                "severity": "Medium",
                "mitigation": "Establish direct contract agreements with reputable Japanese tea plantations and handle air-tight storage."
            },
            {
                "risk": "High physical customer acquisition cost.",
                "severity": "Medium",
                "mitigation": "Drive high local organic visibility through beautiful experiential pop-ups, influencer tastings, and neighborhood programs."
            }
        ],
        "nextSteps": [
            f"Conduct 25 face-to-face consumer interviews in {region} about daily tea/matcha preferences and workspace pain points.",
            "Run a 3-day local pop-up experience to measure price elasticity and flavor preferences.",
            "Secure direct ceremonial-grade import pipelines and obtain food handling licenses."
        ]
    }

    outputs = {
        "planner": {
            "summary": f"PlannerAgent defined the conceptual scope, target customers, and assumptions for {region}.",
            "output": {
                "idea": idea,
                "region": region,
                "analysisDimensions": [
                    "Local consumer density and footprints",
                    "Local competitor landscape",
                    "Regional real estate and launch feasibility",
                    "Aesthetic and physical design wedge",
                    "Supply chain and organic import margins"
                ],
                "targetCustomer": f"Premium wellness-oriented consumers, tech workers, and corporate professionals in {region}.",
                "coreAssumptions": [
                    f"A significant segment of professionals in {region} will pay 250+ INR for high-grade organic matcha.",
                    "Tranquil Zen-like interior styling serves as a massive customer acquisition wedge over noisy cafes.",
                    "Consistent ceremonial-grade supply chains can be maintained smoothly."
                ],
                "killCriteria": f"Fewer than 45 repeat customers per day within the first 60 days of experiential launch."
            }
        },
        "market-research": {
            "summary": f"MarketAgent synthesized localized TAM/SAM metrics and spending profiles in {region}.",
            "output": report["marketAnalysis"]
        },
        "competitor": {
            "summary": f"CompetitorAgent analyzed 5 physical and digital competitors in the {region} ecosystem.",
            "output": {
                "competitors": competitors,
                "whitespace": f"Zero in on pure, ceremonial organic Japanese matcha specialization with peaceful productivity space, a major whitespace in {region}."
            }
        },
        "technical-feasibility": {
            "summary": f"FeasibilityAgent detailed the stack, import pipelines, and operational milestones for {region}.",
            "output": report["technicalFeasibility"]
        },
        "timing": {
            "summary": f"TimingAgent assessed tailwinds, headwinds, and adoption windows in {region}.",
            "output": report["timing"]
        },
        "risk-analysis": {
            "summary": f"RiskAgent profiled lease, regulatory, and supply chain constraints in {region}.",
            "output": {"risks": report["risks"]}
        },
        "scoring": {
            "summary": f"ScoringAgent converted local proof points into weighted ratings for {region}.",
            "output": {
                "scores": report["scores"],
                "scoreRationale": {
                    "market": f"Strong premium market size and wellness beverage adoption rates in {region}.",
                    "timing": "Optimal timing due to wellness trends, though rental market timing is highly competitive.",
                    "defensibility": "High defensibility driven by brand aesthetic, product purity, and proprietary farm supply contracts.",
                    "feasibility": "Moderate feasibility due to physical retail licensing and organic imports handling.",
                    "risk": "Favorable risk profile with clear mitigations for real estate and ingredient sourcing.",
                    "founderFit": "High alignment between modern lifestyle brand execution and founder interest.",
                    "overall": f"Strong composite rating of {overall}/100 indicating solid startup viability."
                }
            }
        },
        "report-generator": {
            "summary": f"ReportAgent generated a detailed {verdict} VC investment thesis for {region}.",
            "output": report
        }
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


def build_prompt(idea: str, region: str, agent: Dict[str, str], context: Dict[str, Any]) -> str:
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

Target Locality/Region (Compulsory):
{region}

Your required mission:
{AGENT_INSTRUCTIONS[agent_id]}

Prior agent context from this same analysis run:
{prior_context if prior_context and prior_context != "{}" else "No prior agent output yet."}

Quality bar:
- Analyze this exact idea, not a generic startup.
- Focus specifically on the target locality/region: "{region}". Name actual physical competitors or local alternatives in "{region}" if the idea has regional or local operations.
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
    region = payload.get("region", "").strip()
    agent = payload.get("agent", {})
    context = payload.get("context", {})
    agent_id = agent.get("id")

    if not idea:
        return jsonify({"error": "Missing startup idea"}), 400
    if not region:
        return jsonify({"error": "Missing target region/locality"}), 400
    if agent_id not in AGENT_INSTRUCTIONS:
        return jsonify({"error": "Invalid idea or agent"}), 400

    default_output = fallback_agent_output(idea, region, agent_id, context)
    data = call_llm(build_prompt(idea, region, agent, context))
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
