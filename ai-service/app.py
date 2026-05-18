import json
import os
import re
from datetime import UTC, datetime
from typing import Any, Dict, List, Tuple

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

load_dotenv()

try:
    from groq import Groq
except ImportError:
    Groq = None

try:
    import google.generativeai as genai
except ImportError:
    genai = None

try:
    from search import WebSearch
except Exception:
    WebSearch = None

app = Flask(__name__)
CORS(app)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_MODEL = "llama-3.3-70b-versatile"
GEMINI_MODEL = "gemini-1.5-flash"
OSM_USER_AGENT = os.getenv("OSM_USER_AGENT", "FounderOS/1.0 local-business-research")
OVERPASS_URL = os.getenv("OVERPASS_URL", "https://overpass-api.de/api/interpreter")
FOURSQUARE_API_KEY = os.getenv("FOURSQUARE_API_KEY", "")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

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


def clean_company_name(title: str) -> str:
    name = re.split(r"\s[-|:]\s| - | \| ", title or "")[0].strip()
    name = re.sub(r"\b(best|top|near me|reviews|menu|photos)\b\s*\d*\s*", "", name, flags=re.IGNORECASE).strip()
    return name[:80] or "Local competitor"


def is_local_physical_idea(idea: str) -> bool:
    terms = [
        "bakery", "bar", "beauty", "beverage", "boutique", "breakfast", "bubble tea", "cafe",
        "clinic", "coffee", "coworking", "dental", "dessert", "diner", "fast food", "fitness",
        "food", "gym", "hotel", "juice", "matcha", "medical", "physical", "pizza", "quick service",
        "restaurant", "retail", "salon", "sandwich", "spa", "takeaway", "tea", "wellness", "yoga",
        "burger", "burgers",
    ]
    lower = idea.lower()
    return any(term in lower for term in terms)


def geocode_region(region: str) -> Dict[str, Any] | None:
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": region, "format": "json", "limit": 1, "addressdetails": 1},
            headers={"User-Agent": OSM_USER_AGENT},
            timeout=10,
        )
        response.raise_for_status()
        results = response.json()
        if not results:
            return None
        item = results[0]
        return {
            "lat": float(item["lat"]),
            "lon": float(item["lon"]),
            "displayName": item.get("display_name", region),
        }
    except Exception as exc:
        app.logger.warning("Region geocoding failed for %s: %s", region, exc)
        return None


def osm_category_filters(idea: str) -> List[Tuple[str, str]]:
    lower = idea.lower()
    filters: List[Tuple[str, str]] = []

    if any(term in lower for term in ["matcha", "tea", "coffee", "cafe", "beverage", "dessert"]):
        filters.extend([("amenity", "cafe"), ("amenity", "restaurant"), ("shop", "tea"), ("shop", "coffee")])
    if any(term in lower for term in ["restaurant", "food", "lunch", "dinner", "breakfast"]):
        filters.extend([("amenity", "restaurant"), ("amenity", "fast_food"), ("amenity", "food_court")])
    if any(term in lower for term in ["burger", "burgers", "fast food", "quick service", "takeaway", "sandwich", "pizza"]):
        filters.extend([("amenity", "fast_food"), ("amenity", "restaurant"), ("cuisine", "burger")])
    if "bakery" in lower:
        filters.extend([("shop", "bakery"), ("amenity", "cafe")])
    if any(term in lower for term in ["gym", "fitness", "workout"]):
        filters.extend([("leisure", "fitness_centre"), ("sport", "fitness")])
    if "yoga" in lower:
        filters.extend([("leisure", "fitness_centre"), ("sport", "yoga")])
    if any(term in lower for term in ["salon", "beauty", "spa"]):
        filters.extend([("shop", "hairdresser"), ("shop", "beauty"), ("leisure", "spa")])
    if any(term in lower for term in ["clinic", "medical", "health", "dental", "doctor"]):
        filters.extend([("amenity", "clinic"), ("amenity", "doctors"), ("amenity", "dentist"), ("amenity", "hospital")])
    if any(term in lower for term in ["coworking", "workspace", "office"]):
        filters.extend([("office", "coworking"), ("amenity", "coworking_space"), ("amenity", "cafe")])
    if any(term in lower for term in ["hotel", "stay", "hostel"]):
        filters.extend([("tourism", "hotel"), ("tourism", "hostel"), ("tourism", "guest_house")])
    if any(term in lower for term in ["retail", "boutique", "fashion", "clothes"]):
        filters.extend([("shop", "clothes"), ("shop", "fashion"), ("shop", "boutique")])
    if "juice" in lower:
        filters.extend([("amenity", "cafe"), ("shop", "beverages")])

    if not filters and is_local_physical_idea(idea):
        filters.extend([("amenity", "cafe"), ("amenity", "restaurant")])

    deduped = []
    seen = set()
    for item in filters:
        if item not in seen:
            seen.add(item)
            deduped.append(item)
    return deduped[:10]


def overpass_filter_block(filters: List[Tuple[str, str]], lat: float, lon: float, radius_m: int) -> str:
    lines = []
    for key, value in filters:
        lines.append(f'node(around:{radius_m},{lat},{lon})["{key}"="{value}"];')
        lines.append(f'way(around:{radius_m},{lat},{lon})["{key}"="{value}"];')
        lines.append(f'relation(around:{radius_m},{lat},{lon})["{key}"="{value}"];')
    return "\n".join(lines)


def local_place_score(idea: str, tags: Dict[str, str], name: str) -> int:
    lower = idea.lower()
    name_lower = name.lower()
    category = {
        "amenity": tags.get("amenity", ""),
        "shop": tags.get("shop", ""),
        "leisure": tags.get("leisure", ""),
        "tourism": tags.get("tourism", ""),
        "office": tags.get("office", ""),
        "sport": tags.get("sport", ""),
    }
    score = 50

    if any(term in lower for term in ["matcha", "tea", "coffee", "cafe", "beverage", "dessert"]):
        if category["shop"] in {"tea", "coffee"}:
            score -= 30
        if category["amenity"] == "cafe":
            score -= 24
        if category["amenity"] == "restaurant":
            score += 10
    if "bakery" in lower and category["shop"] == "bakery":
        score -= 30
    if any(term in lower for term in ["gym", "fitness"]) and category["leisure"] == "fitness_centre":
        score -= 30
    if "yoga" in lower and category["sport"] == "yoga":
        score -= 30
    if any(term in lower for term in ["salon", "beauty", "spa"]) and (category["shop"] in {"hairdresser", "beauty"} or category["leisure"] == "spa"):
        score -= 30
    if any(term in lower for term in ["clinic", "medical", "health", "dental", "doctor"]) and category["amenity"] in {"clinic", "doctors", "dentist", "hospital"}:
        score -= 30
    if any(term in lower for term in ["coworking", "workspace"]) and (category["office"] == "coworking" or category["amenity"] == "coworking_space"):
        score -= 30

    for keyword in re.findall(r"[a-zA-Z]{4,}", lower):
        if keyword in name_lower:
            score -= 8
    return score


def place_search_query(idea: str) -> str:
    lower = idea.lower()
    if any(term in lower for term in ["matcha", "tea"]):
        return "tea cafe"
    if any(term in lower for term in ["coffee", "cafe", "beverage"]):
        return "cafe coffee"
    if "bakery" in lower:
        return "bakery cafe"
    if any(term in lower for term in ["burger", "burgers"]):
        return "burger restaurant"
    if any(term in lower for term in ["pizza"]):
        return "pizza restaurant"
    if any(term in lower for term in ["fast food", "quick service", "takeaway", "sandwich"]):
        return "fast food restaurant"
    if any(term in lower for term in ["restaurant", "food", "lunch", "dinner", "breakfast"]):
        return "restaurant"
    if any(term in lower for term in ["juice", "smoothie"]):
        return "juice"
    if any(term in lower for term in ["gym", "fitness"]):
        return "gym fitness"
    if "yoga" in lower:
        return "yoga"
    if any(term in lower for term in ["salon", "beauty", "spa"]):
        return "salon spa"
    if any(term in lower for term in ["clinic", "medical", "health", "dental", "doctor"]):
        return "clinic"
    return idea_search_terms(idea)


def foursquare_categories(idea: str) -> str:
    lower = idea.lower()
    categories = []
    if any(term in lower for term in ["matcha", "tea", "coffee", "cafe", "beverage", "dessert"]):
        categories.extend(["13032", "13034", "13035", "13036"])
    if any(term in lower for term in ["restaurant", "food", "lunch", "dinner", "breakfast"]):
        categories.append("13065")
    if "bakery" in lower:
        categories.append("13002")
    if any(term in lower for term in ["gym", "fitness"]):
        categories.append("18021")
    if "yoga" in lower:
        categories.append("18060")
    if any(term in lower for term in ["salon", "beauty", "spa"]):
        categories.extend(["11064", "11073"])
    if any(term in lower for term in ["clinic", "medical", "health", "dental", "doctor"]):
        categories.extend(["15014", "15007", "15010"])
    return ",".join(dict.fromkeys(categories))


def search_foursquare_places(idea: str, region: str) -> List[Dict[str, str]]:
    if not FOURSQUARE_API_KEY or not is_local_physical_idea(idea):
        return []

    location = geocode_region(region)
    params = {
        "query": place_search_query(idea),
        "limit": 10,
        "radius": 6000,
        "sort": "RELEVANCE",
        "fields": "fsq_id,name,categories,location,distance,geocodes,website,tel",
    }
    if location:
        params["ll"] = f"{location['lat']},{location['lon']}"
    else:
        params["near"] = region

    categories = foursquare_categories(idea)
    if categories:
        params["categories"] = categories

    try:
        response = requests.get(
            "https://api.foursquare.com/v3/places/search",
            params=params,
            headers={
                "Accept": "application/json",
                "Authorization": FOURSQUARE_API_KEY,
            },
            timeout=18,
        )
        response.raise_for_status()
        results = response.json().get("results", [])
    except Exception as exc:
        app.logger.warning("Foursquare place search failed for %s/%s: %s", idea, region, exc)
        return []

    places = []
    for result in results:
        name = (result.get("name") or "").strip()
        if not name:
            continue
        categories_text = ", ".join(
            category.get("name", "")
            for category in result.get("categories", [])
            if category.get("name")
        )
        address = result.get("location", {}).get("formatted_address") or ", ".join(
            part for part in [
                result.get("location", {}).get("address"),
                result.get("location", {}).get("locality"),
                result.get("location", {}).get("region"),
            ] if part
        )
        distance = result.get("distance")
        distance_text = f"{round(distance / 1000, 1)} km away" if isinstance(distance, (int, float)) else "nearby"
        fsq_id = result.get("fsq_id", "")
        url = result.get("website") or (f"https://foursquare.com/v/{fsq_id}" if fsq_id else "")
        phone = result.get("tel", "")
        snippet_parts = [
            categories_text or "Local business",
            f"{distance_text} from {region}",
            address,
            f"Phone: {phone}" if phone else "",
        ]
        places.append(
            {
                "query": f"Foursquare Places: {params['query']}",
                "title": name,
                "snippet": ". ".join(part for part in snippet_parts if part),
                "url": url,
                "source": "foursquare",
            }
        )
    return places


def google_included_type(idea: str) -> str:
    lower = idea.lower()
    if any(term in lower for term in ["coffee", "cafe", "matcha", "tea"]):
        return "cafe"
    if "bakery" in lower:
        return "bakery"
    if any(term in lower for term in ["restaurant", "food", "lunch", "dinner", "breakfast", "burger", "burgers", "pizza", "fast food", "quick service", "takeaway", "sandwich"]):
        return "restaurant"
    if any(term in lower for term in ["gym", "fitness"]):
        return "gym"
    if "spa" in lower:
        return "spa"
    if "beauty" in lower or "salon" in lower:
        return "beauty_salon"
    if "dental" in lower:
        return "dentist"
    if any(term in lower for term in ["clinic", "medical", "health", "doctor"]):
        return "doctor"
    return ""


def google_review_text(review: Dict[str, Any]) -> str:
    text = review.get("text", {})
    if isinstance(text, dict):
        return text.get("text", "") or text.get("originalText", {}).get("text", "")
    if isinstance(text, str):
        return text
    original = review.get("originalText", {})
    if isinstance(original, dict):
        return original.get("text", "")
    return ""


def google_place_details(place_id: str) -> Dict[str, Any]:
    if not place_id:
        return {}
    try:
        response = requests.get(
            f"https://places.googleapis.com/v1/places/{place_id}",
            headers={
                "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                "X-Goog-FieldMask": (
                    "id,displayName,formattedAddress,googleMapsUri,websiteUri,nationalPhoneNumber,"
                    "rating,userRatingCount,priceLevel,types,reviews,reviewSummary,generativeSummary"
                ),
            },
            timeout=16,
        )
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        app.logger.warning("Google Place Details failed for %s: %s", place_id, exc)
        return {}


def search_google_places(idea: str, region: str) -> List[Dict[str, Any]]:
    if not GOOGLE_MAPS_API_KEY or not is_local_physical_idea(idea):
        return []

    body: Dict[str, Any] = {
        "textQuery": f"{place_search_query(idea)} near {region}",
        "pageSize": 8,
        "rankPreference": "RELEVANCE",
        "languageCode": "en",
    }
    included_type = google_included_type(idea)
    if included_type:
        body["includedType"] = included_type
        body["strictTypeFiltering"] = False

    try:
        response = requests.post(
            "https://places.googleapis.com/v1/places:searchText",
            json=body,
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                "X-Goog-FieldMask": (
                    "places.id,places.displayName,places.formattedAddress,places.googleMapsUri,"
                    "places.rating,places.userRatingCount,places.types"
                ),
            },
            timeout=18,
        )
        response.raise_for_status()
        results = response.json().get("places", [])
    except Exception as exc:
        app.logger.warning("Google Places Text Search failed for %s/%s: %s", idea, region, exc)
        return []

    places = []
    for result in results:
        place_id = result.get("id", "")
        details = google_place_details(place_id)
        place = details or result
        name = place.get("displayName", {}).get("text") or result.get("displayName", {}).get("text") or ""
        if not name:
            continue
        reviews = []
        for review in place.get("reviews", []) or []:
            text = google_review_text(review).strip()
            if not text:
                continue
            reviews.append(
                {
                    "rating": review.get("rating"),
                    "text": text[:900],
                    "relativeTime": review.get("relativePublishTimeDescription", ""),
                    "author": review.get("authorAttribution", {}).get("displayName", ""),
                }
            )
        rating = place.get("rating") or result.get("rating")
        review_count = place.get("userRatingCount") or result.get("userRatingCount")
        maps_url = place.get("googleMapsUri") or result.get("googleMapsUri") or ""
        review_summary = place.get("reviewSummary", {}).get("text", {}).get("text", "")
        review_summary_url = place.get("reviewSummary", {}).get("reviewsUri", "")
        generative_summary = place.get("generativeSummary", {}).get("overview", {}).get("text", "")
        address = place.get("formattedAddress") or result.get("formattedAddress") or ""
        types = place.get("types") or result.get("types") or []
        snippet_parts = [
            ", ".join(t.replace("_", " ") for t in types[:3]),
            address,
            f"Rating: {rating}" if rating else "",
            f"Reviews: {review_count}" if review_count else "",
        ]
        places.append(
            {
                "query": f"Google Places: {body['textQuery']}",
                "title": name,
                "snippet": ". ".join(part for part in snippet_parts if part),
                "url": maps_url,
                "source": "google_places",
                "placeId": place_id,
                "rating": rating,
                "reviewCount": review_count,
                "reviews": reviews,
                "reviewSummary": review_summary,
                "reviewSummaryUrl": review_summary_url,
                "generativeSummary": generative_summary,
                "phone": place.get("nationalPhoneNumber", ""),
                "website": place.get("websiteUri", ""),
            }
        )
    return places


def search_local_places(idea: str, region: str) -> List[Dict[str, str]]:
    if not is_local_physical_idea(idea):
        return []

    location = geocode_region(region)
    filters = osm_category_filters(idea)
    if not location or not filters:
        return []

    query = f"""
[out:json][timeout:25];
(
{overpass_filter_block(filters, location["lat"], location["lon"], 5500)}
);
out center tags 80;
"""
    try:
        response = requests.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": OSM_USER_AGENT},
            timeout=22,
        )
        response.raise_for_status()
        elements = response.json().get("elements", [])
    except Exception as exc:
        app.logger.warning("Overpass local place search failed for %s/%s: %s", idea, region, exc)
        return []

    places = []
    seen = set()
    for element in elements:
        tags = element.get("tags", {})
        name = (tags.get("name") or tags.get("brand") or "").strip()
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        category = tags.get("amenity") or tags.get("shop") or tags.get("leisure") or tags.get("tourism") or tags.get("office") or "local business"
        address = ", ".join(
            part
            for part in [
                tags.get("addr:street"),
                tags.get("addr:suburb") or tags.get("addr:neighbourhood"),
                tags.get("addr:city"),
            ]
            if part
        )
        lat = element.get("lat") or element.get("center", {}).get("lat")
        lon = element.get("lon") or element.get("center", {}).get("lon")
        maps_url = f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}#map=18/{lat}/{lon}" if lat and lon else ""
        places.append(
            {
                "_score": local_place_score(idea, tags, name),
                "query": f"OpenStreetMap Overpass: {filters}",
                "title": name,
                "snippet": f"{category.replace('_', ' ').title()} near {location['displayName']}. {address}".strip(),
                "url": maps_url,
                "source": "openstreetmap",
            }
        )
        if len(places) >= 50:
            break

    ranked = sorted(places, key=lambda item: (item.pop("_score", 50), item["title"].lower()))
    return ranked[:10]


def idea_search_terms(idea: str) -> str:
    stopwords = {
        "a", "an", "and", "app", "application", "business", "build", "company", "for", "in",
        "into", "of", "on", "platform", "service", "startup", "that", "the", "to", "with",
    }
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{2,}", idea.lower())
    filtered = [word for word in words if word not in stopwords]
    return " ".join(filtered[:7]) or idea[:80]


def competitor_search_queries(idea: str, region: str) -> List[str]:
    terms = place_search_query(idea) if is_local_physical_idea(idea) else idea_search_terms(idea)
    return [
        f'{terms} in "{region}"',
        f'{terms} near "{region}"',
        f'best {terms} "{region}"',
    ]


def is_bad_local_result(idea: str, title: str, snippet: str, url: str) -> bool:
    combined = f"{title} {snippet} {url}".lower()
    lower = idea.lower()
    if any(term in combined for term in ["top 10", "directory", "list of", "/category/", "placedigger"]):
        return True
    if any(term in combined for term in ["cyber cafe", "internet cafe", "internet caf"]) and not any(term in lower for term in ["cyber", "internet"]):
        return True
    return False


def search_competitor_evidence(idea: str, region: str) -> List[Dict[str, str]]:
    seen = set()
    evidence = []

    for result in search_google_places(idea, region):
        key = (result.get("placeId") or result.get("url") or result.get("title", "")).lower()
        if key and key not in seen:
            seen.add(key)
            evidence.append(result)

    if len(evidence) >= 5:
        return evidence[:8]

    for result in search_foursquare_places(idea, region):
        key = (result.get("url") or result.get("title", "")).lower()
        if key and key not in seen:
            seen.add(key)
            evidence.append(result)

    if len(evidence) >= 5:
        return evidence[:8]

    for result in search_local_places(idea, region):
        key = (result.get("url") or result.get("title", "")).lower()
        if key and key not in seen:
            seen.add(key)
            evidence.append(result)

    if len(evidence) >= 8 or not WebSearch:
        return evidence[:8]

    searcher = WebSearch()
    for query in competitor_search_queries(idea, region)[:2]:
        for result in searcher.search(query, max_results=5):
            url = result.get("url", "")
            title = result.get("title", "")
            snippet = result.get("snippet", "")
            if is_bad_local_result(idea, title, snippet, url):
                continue
            key = (url or title).lower()
            if not key or key in seen:
                continue
            seen.add(key)
            evidence.append(
                {
                    "query": query,
                    "title": title,
                    "snippet": snippet,
                    "url": url,
                    "source": "web",
                }
            )
            if len(evidence) >= 8:
                return evidence
    return evidence


def format_competitor_evidence(evidence: List[Dict[str, str]]) -> str:
    if not evidence:
        return "No live competitor search results were available; use careful estimates and label uncertainty."

    lines = ["Live competitor search evidence:"]
    for index, item in enumerate(evidence, 1):
        lines.append(f"[{index}] Source: {item.get('source', 'web')}")
        lines.append(f"[{index}] Query: {item.get('query', '')}")
        lines.append(f"Title: {item.get('title', '')}")
        lines.append(f"Snippet: {item.get('snippet', '')}")
        lines.append(f"URL: {item.get('url', '')}")
    return "\n".join(lines)


def competitors_from_evidence(evidence: List[Dict[str, str]], idea: str, region: str) -> List[Dict[str, str]]:
    competitors = []
    seen = set()
    for item in evidence:
        name = clean_company_name(item.get("title", ""))
        key = name.lower()
        if key in seen or len(name) < 3:
            continue
        seen.add(key)
        snippet = item.get("snippet") or f"Appeared in search results for similar businesses in {region}."
        competitors.append(
            {
                "name": name,
                "positioning": f"Existing local or reachable alternative found for {region}. Evidence: {snippet[:260]} Source: {item.get('url', 'source unavailable')}",
                "strengths": "Visible in live local-business/search data, which suggests market presence, discoverability, or category relevance.",
                "weakness": f"Exact product depth versus '{idea[:80]}' needs manual validation through reviews, menus, pricing pages, or calls.",
                "threatLevel": "High" if len(competitors) < 2 else "Medium",
                "source": item.get("source", "web"),
                "sourceUrl": item.get("url", ""),
                "rating": item.get("rating"),
                "reviewCount": item.get("reviewCount"),
                "reviews": item.get("reviews", []),
                "reviewSummary": item.get("reviewSummary", ""),
                "reviewSummaryUrl": item.get("reviewSummaryUrl", ""),
                "generativeSummary": item.get("generativeSummary", ""),
            }
        )
        if len(competitors) >= 5:
            break
    return competitors


REVIEW_GAP_KEYWORDS = {
    "service": ["rude", "slow service", "service", "staff", "waiter", "ignored", "delay", "late"],
    "wait time": ["waiting", "wait", "delay", "slow", "queue", "late", "time"],
    "food quality": ["cold", "stale", "taste", "bad food", "quality", "undercooked", "overcooked", "oily"],
    "pricing": ["expensive", "overpriced", "price", "costly", "not worth", "value"],
    "cleanliness": ["dirty", "clean", "hygiene", "washroom", "smell", "unclean"],
    "ambience": ["crowded", "noisy", "ambience", "seating", "music", "space", "parking"],
    "menu gaps": ["limited", "menu", "options", "variety", "available", "unavailable"],
}


def review_gaps_from_evidence(evidence: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    themes: Dict[str, Dict[str, Any]] = {}
    for item in evidence:
        business = item.get("title", "")
        for review in item.get("reviews", []) or []:
            text = review.get("text", "")
            if not text:
                continue
            lower = text.lower()
            rating = review.get("rating")
            is_negative = isinstance(rating, (int, float)) and rating <= 3
            for theme, keywords in REVIEW_GAP_KEYWORDS.items():
                if not any(keyword in lower for keyword in keywords):
                    continue
                if not is_negative and not any(marker in lower for marker in ["bad", "poor", "slow", "not", "worst", "expensive", "dirty", "limited"]):
                    continue
                bucket = themes.setdefault(theme, {"theme": theme, "mentions": 0, "businesses": set(), "examples": []})
                bucket["mentions"] += 1
                if business:
                    bucket["businesses"].add(business)
                if len(bucket["examples"]) < 3:
                    bucket["examples"].append({"business": business, "rating": rating, "text": text[:240]})

        summary_text = " ".join(
            part for part in [item.get("reviewSummary", ""), item.get("generativeSummary", "")] if part
        )
        lower_summary = summary_text.lower()
        if summary_text and any(marker in lower_summary for marker in ["but", "however", "limited", "crowded", "slow", "expensive", "noisy", "parking", "wait"]):
            for theme, keywords in REVIEW_GAP_KEYWORDS.items():
                if not any(keyword in lower_summary for keyword in keywords):
                    continue
                bucket = themes.setdefault(theme, {"theme": theme, "mentions": 0, "businesses": set(), "examples": []})
                bucket["mentions"] += 1
                if business:
                    bucket["businesses"].add(business)
                if len(bucket["examples"]) < 3:
                    bucket["examples"].append({"business": business, "rating": item.get("rating"), "text": summary_text[:240]})

    gaps = []
    for item in sorted(themes.values(), key=lambda value: value["mentions"], reverse=True):
        gaps.append(
            {
                "theme": item["theme"],
                "mentions": item["mentions"],
                "businesses": sorted(item["businesses"]),
                "opportunity": review_gap_opportunity(item["theme"]),
                "examples": item["examples"],
            }
        )
    return gaps[:6]


def review_gap_opportunity(theme: str) -> str:
    opportunities = {
        "service": "Win with staff training, faster table handling, and visible service standards.",
        "wait time": "Design faster ordering, prep batching, and clear pickup/dine-in flows.",
        "food quality": "Compete on consistency, fresh prep, and a smaller high-quality menu.",
        "pricing": "Use transparent pricing, student/family combos, and clear value bundles.",
        "cleanliness": "Make hygiene, restroom quality, and table turnover visible operating strengths.",
        "ambience": "Create quieter seating, better lighting, family comfort, and remote-work friendly zones.",
        "menu gaps": "Add focused menu variety around the unmet use case without becoming bloated.",
    }
    return opportunities.get(theme, "Turn repeated complaints into operating standards for the new concept.")


def fallback_agent_output(
    idea: str,
    region: str,
    agent_id: str,
    context: Dict[str, Any],
    competitor_evidence: List[Dict[str, str]] | None = None,
) -> Dict[str, Any]:
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

    searched_competitors = competitors_from_evidence(competitor_evidence or [], idea, region)
    review_gaps = review_gaps_from_evidence(competitor_evidence or [])

    if searched_competitors:
        competitors = searched_competitors
    elif is_local_physical_idea(idea):
        competitors = [
            {
                "name": "No verified local competitor returned",
                "positioning": (
                    f"FounderOS could not verify nearby similar businesses for {region} from the configured live place sources. "
                    "Add FOURSQUARE_API_KEY for stronger coverage, then rerun this analysis."
                ),
                "strengths": "Not enough verified live data to make a competitor claim.",
                "weakness": "A manual Google Maps/Foursquare check is required before making launch decisions.",
                "threatLevel": "Unknown",
                "source": "none",
                "sourceUrl": "",
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
        "reviewGaps": review_gaps,
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


def apply_live_competitors(output: Dict[str, Any], evidence: List[Dict[str, str]], idea: str, region: str) -> Dict[str, Any]:
    live_competitors = competitors_from_evidence(evidence, idea, region)
    if not live_competitors:
        return output
    output["competitors"] = live_competitors
    output["reviewGaps"] = review_gaps_from_evidence(evidence)
    output["competitorSource"] = {
        "type": "live-local-search",
        "sources": [
            {"title": item.get("title", ""), "url": item.get("url", ""), "source": item.get("source", "web")}
            for item in evidence
            if item.get("title")
        ],
    }
    return output


def provider_meta(data: Dict[str, Any]) -> Dict[str, Any]:
    meta = {"provider": data.pop("_provider", "unknown")}
    if "_errors" in data:
        meta["errors"] = data.pop("_errors")
    return meta


def build_prompt(
    idea: str,
    region: str,
    agent: Dict[str, str],
    context: Dict[str, Any],
    competitor_evidence: str = "",
) -> str:
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

    if agent_id == "competitor":
        output_contract = """
Return strict JSON only:
{
  "summary": "one specific sentence",
  "output": {
    "competitors": [
      { "name": "real local business or substitute", "positioning": "what they sell and where the evidence came from", "strengths": "specific strengths", "weakness": "specific weakness", "threatLevel": "Low|Medium|High" }
    ],
    "reviewGaps": [{ "theme": "repeated complaint theme", "mentions": number, "opportunity": "how the startup can exploit this gap" }],
    "whitespace": "specific local opportunity"
  }
}
Use the live competitor/local business evidence first. If Google review evidence is provided, extract repeated complaints into reviewGaps.
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
    "reviewGaps": [{ "theme": "repeated complaint theme from reviews", "mentions": number, "businesses": ["business"], "opportunity": "gap the new startup can attack", "examples": [{ "business": "business", "rating": number, "text": "short excerpt" }] }],
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

Competitor/local business evidence:
{competitor_evidence or "No extra competitor evidence collected for this agent."}

Quality bar:
- Analyze this exact idea, not a generic startup.
- Focus specifically on the target locality/region: "{region}". Name actual physical competitors or local alternatives in "{region}" if the idea has regional or local operations.
- When competitor evidence is provided, use it as the first source of truth for existing similar businesses and do not replace local evidence with generic global companies.
- If live local-business evidence is provided, preserve the exact business names from that evidence in the competitor list.
- If Google Places reviews are present, identify repeated customer complaints and convert them into concrete whitespace opportunities.
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

    competitor_evidence = []
    if agent_id in {"competitor", "report-generator"}:
        competitor_evidence = search_competitor_evidence(idea, region)

    default_output = fallback_agent_output(idea, region, agent_id, context, competitor_evidence)
    data = call_llm(build_prompt(idea, region, agent, context, format_competitor_evidence(competitor_evidence)))
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
    if agent_id == "competitor":
        data["output"] = apply_live_competitors(data["output"], competitor_evidence, idea, region)
    data["output"] = normalize_scores(data["output"])
    data["provider"] = meta["provider"]

    if agent_id == "report-generator":
        data["output"] = merge_defaults(data.get("output"), default_output["output"])
        data["output"] = apply_live_competitors(data["output"], competitor_evidence, idea, region)
        data["output"] = normalize_scores(data["output"])

    return jsonify(data)


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", "8000"))
    print(f"FounderOS AI service running on http://localhost:{port} at {datetime.now(UTC).isoformat()}")
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
