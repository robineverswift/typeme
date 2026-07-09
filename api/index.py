#!/usr/bin/env python3
"""TypeMe — Vercel Serverless (Flask)."""
import base64, hashlib, hmac, json, os, random, re, secrets, sys, time, traceback
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from flask import Flask, request, jsonify, make_response

app = Flask(__name__)

# ── Load data ──
HERE = Path(__file__).parent.parent
DATA_PATH = HERE / "questions.json"
TEMPLATES = Path(__file__).parent / "templates"
PUBLIC = HERE / "public"

# ── Config from env ──
AI_API_KEY = os.environ.get("AI_API_KEY", os.environ.get("DEEPSEEK_API_KEY", "")).strip()
AI_URL = os.environ.get("AI_URL", "https://api.deepseek.com/v1/chat/completions")
AI_MODEL = os.environ.get("AI_MODEL", "deepseek-chat")
AI_AUTH_HEADER = os.environ.get("AI_AUTH_HEADER", "Authorization")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
STUDIO_COOKIE_SECRET = os.environ.get("STUDIO_COOKIE_SECRET", "")
STUDIO_ADMIN_EMAILS = {
    email.strip().lower()
    for email in os.environ.get("STUDIO_ADMIN_EMAILS", "").split(",")
    if email.strip()
}
STUDIO_COOKIE_ACCESS = "pm_studio_access"
STUDIO_COOKIE_REFRESH = "pm_studio_refresh"
STUDIO_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
SAMPLE_SCHEMA_VERSION = "persona_sample_v1"
SAMPLE_MAX_BODY_BYTES = 260_000
SAMPLE_ALLOWED_TOP_KEYS = {
    "schema_version", "app_version", "client_version", "question_version", "prompt_version",
    "client_sample_id", "created_at", "source_locale", "quality_flags", "analysis_status", "consent", "traditional", "ai",
    "final_type", "answers", "open_answers", "selected_questions", "feedback",
}

DIM_ORDER = ["EI", "SN", "TF", "JP", "AT"]
DIM_POLES = {
    "EI": ("E", "I"),
    "SN": ("S", "N"),
    "TF": ("T", "F"),
    "JP": ("J", "P"),
    "AT": ("A", "T"),
}
FIRST_POLES = {dim: poles[0] for dim, poles in DIM_POLES.items()}

_NONSENSE_RE = re.compile(
    r"^(.)\1{2,}$|^[a-zA-Z]{1,3}$|^(.){1,2}$|"
    r"^(嗯|哦|啊|哈|是|对|好|行|不|无|有|没|了|的){1,4}$|"
    r"^(asdf|qwer|test|测试|111|222|aaa|bbb)$", re.IGNORECASE)
_OPEN_SIGNAL_RE = re.compile(r"[A-Za-z0-9\u4e00-\u9fff]")
_OPEN_SCENE_RE = re.compile(
    r"因为|当时|后来|所以|但是|如果|选择|冲突|压力|例子|具体|场景|关系|决定|后悔|担心|害怕|希望|感觉|认为|自己|"
    r"because|when|then|later|choice|conflict|pressure|example|specific|relationship|decide|regret|worry|afraid|feel|think|myself",
    re.IGNORECASE,
)
_OPEN_CAUSE_RE = re.compile(r"因为|所以|导致|于是|结果|原因|why|because|so|therefore|result", re.IGNORECASE)
_OPEN_CHOICE_RE = re.compile(r"选择|决定|行动|处理|拒绝|接受|靠近|离开|choice|decide|action|handle|refuse|accept|approach|leave", re.IGNORECASE)
_OPEN_EMOTION_RE = re.compile(r"感觉|情绪|害怕|担心|后悔|委屈|失落|兴奋|焦虑|愤怒|开心|feel|felt|emotion|afraid|worry|regret|sad|angry|happy|anxious", re.IGNORECASE)
_OPEN_TIME_RE = re.compile(r"当时|后来|之前|之后|最近|上次|有一次|when|then|later|before|after|recently|once", re.IGNORECASE)
_OPEN_REPEAT_RE = re.compile(r"(.{2,8})\1{2,}", re.IGNORECASE)

questions_data = {}
try:
    if DATA_PATH.exists():
        with open(DATA_PATH, encoding="utf-8") as f:
            questions_data = json.load(f)
except Exception as e:
    print(f"WARN: failed to load questions.json: {e}")


def json_response(data, status=200, extra_headers=None):
    body = json.dumps(data, ensure_ascii=False)
    response = make_response(body, status)
    response.headers["Content-Type"] = "application/json; charset=utf-8"
    response.headers["Cache-Control"] = "no-store"
    for key, value in (extra_headers or []):
        response.headers[key] = value
    return response


def _safe_int(value, default=0):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _studio_ai_configured():
    return bool(AI_API_KEY or os.environ.get("AI_API_KEY") or os.environ.get("DEEPSEEK_API_KEY"))


def is_db_enabled():
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def _studio_auth_configured():
    return bool(SUPABASE_URL and SUPABASE_ANON_KEY and STUDIO_ADMIN_EMAILS)


def _studio_secret():
    seed = STUDIO_COOKIE_SECRET or SUPABASE_SERVICE_ROLE_KEY or AI_API_KEY or "typeme-studio"
    return seed.encode("utf-8")


def _b64url(data):
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _sign_token(value):
    sig = hmac.new(_studio_secret(), value.encode("utf-8"), hashlib.sha256).digest()
    return f"{value}.{_b64url(sig)}"


def _unsign_token(signed):
    if not signed or "." not in signed:
        return ""
    value, sig = signed.rsplit(".", 1)
    expected = _b64url(hmac.new(_studio_secret(), value.encode("utf-8"), hashlib.sha256).digest())
    return value if hmac.compare_digest(sig, expected) else ""


def _cookie_secure():
    return request.is_secure or request.headers.get("x-forwarded-proto", "").lower() == "https"


def _set_studio_cookie(response, name, value, max_age=STUDIO_COOKIE_MAX_AGE):
    response.set_cookie(
        name,
        value,
        max_age=max_age,
        httponly=True,
        secure=_cookie_secure(),
        samesite="Lax",
        path="/",
    )


def _clear_studio_cookies(response):
    _set_studio_cookie(response, STUDIO_COOKIE_ACCESS, "", 0)
    _set_studio_cookie(response, STUDIO_COOKIE_REFRESH, "", 0)


def _supabase_auth_request(path, payload=None, access_token=None):
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return 503, {"error": "Supabase Auth is not configured"}
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = Request(f"{SUPABASE_URL}/auth/v1/{path}", data=body, method="GET" if payload is None else "POST")
    req.add_header("apikey", SUPABASE_ANON_KEY)
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {access_token or SUPABASE_ANON_KEY}")
    try:
        with urlopen(req, timeout=10) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else None
    except HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(raw) if raw else {"error": e.reason}
        except json.JSONDecodeError:
            return e.code, {"error": raw or e.reason}
    except (URLError, TimeoutError) as e:
        return 502, {"error": str(e)}


def _db_headers():
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def db_request(path, method="GET", payload=None):
    if not is_db_enabled():
        return 503, {"error": "Supabase is not configured"}
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = Request(f"{SUPABASE_URL}/rest/v1/{path}", data=body, method=method)
    for key, value in _db_headers().items():
        req.add_header(key, value)
    try:
        with urlopen(req, timeout=10) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else None
    except HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw) if raw else {"error": e.reason}
        except json.JSONDecodeError:
            parsed = {"error": raw or e.reason}
        return e.code, parsed
    except (URLError, TimeoutError) as e:
        return 502, {"error": str(e)}


def list_rows(table, columns="*", order="created_at.desc", limit=200):
    query = urlencode({"select": columns, "order": order, "limit": str(limit)})
    return db_request(f"{quote(table)}?{query}")


def get_row(table, row_id):
    query = urlencode({"id": f"eq.{row_id}", "select": "*", "limit": "1"})
    status, rows = db_request(f"{quote(table)}?{query}")
    if status < 300 and isinstance(rows, list):
        return status, rows[0] if rows else None
    return status, rows


def create_row(table, data):
    return db_request(quote(table), "POST", data)


def update_row(table, row_id, data):
    query = urlencode({"id": f"eq.{row_id}"})
    return db_request(f"{quote(table)}?{query}", "PATCH", data)


def delete_row(table, row_id):
    query = urlencode({"id": f"eq.{row_id}"})
    return db_request(f"{quote(table)}?{query}", "DELETE")


def _studio_state(email="", authenticated=False, is_admin=False):
    return {
        "authenticated": authenticated,
        "email": email,
        "isAdmin": is_admin,
        "authConfigured": _studio_auth_configured(),
        "localAuthConfigured": False,
        "dbConfigured": is_db_enabled(),
        "adminEmailsConfigured": bool(STUDIO_ADMIN_EMAILS),
    }


def _studio_user():
    access = _unsign_token(request.cookies.get(STUDIO_COOKIE_ACCESS, ""))
    if not access:
        return None, _studio_state()
    status, user = _supabase_auth_request("user", access_token=access)
    if status >= 300 or not isinstance(user, dict):
        return None, _studio_state(authenticated=False)
    email = (user.get("email") or "").lower()
    is_admin = bool(email and email in STUDIO_ADMIN_EMAILS)
    return user, _studio_state(email=email, authenticated=True, is_admin=is_admin)


def _studio_user_with_refresh():
    user, state = _studio_user()
    if state.get("authenticated"):
        return user, state, None
    refresh = _unsign_token(request.cookies.get(STUDIO_COOKIE_REFRESH, ""))
    if not refresh or not _studio_auth_configured():
        return user, state, None
    status, auth = _supabase_auth_request("token?grant_type=refresh_token", {"refresh_token": refresh})
    if status >= 300 or not isinstance(auth, dict):
        return None, _studio_state(), None
    access = auth.get("access_token", "")
    new_refresh = auth.get("refresh_token", refresh)
    auth_user = auth.get("user") or {}
    email = (auth_user.get("email") or "").lower()
    is_admin = bool(email and email in STUDIO_ADMIN_EMAILS)
    response = json_response(_studio_state(email=email, authenticated=True, is_admin=is_admin))
    _set_studio_cookie(response, STUDIO_COOKIE_ACCESS, _sign_token(access))
    _set_studio_cookie(response, STUDIO_COOKIE_REFRESH, _sign_token(new_refresh))
    return auth_user, _studio_state(email=email, authenticated=True, is_admin=is_admin), response


def _require_studio_admin():
    user, state, refresh_response = _studio_user_with_refresh()
    if not state.get("authenticated"):
        return None, state, refresh_response or json_response({"error": "Studio login required", **state}, 401)
    if not state.get("isAdmin"):
        return None, state, json_response({"error": "Studio admin access required", **state}, 403)
    return user, state, None


def _clip_sample_text(value, limit=8000):
    return "" if value is None else str(value)[:limit]


def _clip_json(value, depth=0):
    if depth > 8:
        return None
    if isinstance(value, dict):
        return {str(k)[:80]: _clip_json(v, depth + 1) for k, v in list(value.items())[:80]}
    if isinstance(value, list):
        return [_clip_json(v, depth + 1) for v in value[:120]]
    if isinstance(value, str):
        return _clip_sample_text(value)
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return str(value)[:500]


def _normalize_sample_type(value):
    text = str(value or "").strip().upper()
    if not text:
        return ""
    match = ""
    for i in range(max(0, len(text) - 3)):
        part = text[i:i + 4]
        if len(part) == 4 and part[0] in "IE" and part[1] in "SN" and part[2] in "TF" and part[3] in "JP":
            match = part
            break
    if not match:
        return text[:16]
    suffix = "-T" if "-T" in text else "-A" if "-A" in text else ""
    return f"{match}{suffix}"


def _sanitize_response_sample(payload):
    if not isinstance(payload, dict):
        raise ValueError("Sample payload must be a JSON object")
    consent = payload.get("consent") or {}
    if not isinstance(consent, dict) or consent.get("scope") != "anonymous_research":
        raise ValueError("Anonymous research consent is required")
    if consent.get("raw_open_answers") is not True:
        raise ValueError("Open-answer consent must be explicit")

    clean = {key: _clip_json(payload.get(key)) for key in SAMPLE_ALLOWED_TOP_KEYS if key in payload}
    clean["schema_version"] = clean.get("schema_version") or SAMPLE_SCHEMA_VERSION
    clean["consent"] = {
        "scope": "anonymous_research",
        "raw_open_answers": True,
        "submitted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    traditional = clean.get("traditional") if isinstance(clean.get("traditional"), dict) else {}
    ai = clean.get("ai") if isinstance(clean.get("ai"), dict) else {}
    quality_flags = clean.get("quality_flags") if isinstance(clean.get("quality_flags"), dict) else ai.get("quality_flags", {})
    analysis_status = str(clean.get("analysis_status") or ai.get("analysis_status") or ("ai_reviewed" if ai.get("ai_available") else "unknown"))[:64]
    final_type = _normalize_sample_type(
        clean.get("final_type")
        or ai.get("final_type")
        or ai.get("ai_type")
        or traditional.get("typeCode")
        or f"{traditional.get('type', '')}-{traditional.get('identity', '')}"
    )
    traditional_type = _normalize_sample_type(
        ai.get("traditional_type") or f"{traditional.get('type', '')}-{traditional.get('identity', '')}"
    )
    ai_type = _normalize_sample_type(ai.get("ai_type") or ai.get("final_type"))
    sample_seed = clean.get("client_sample_id") or secrets.token_hex(12)
    sample_id = hashlib.sha256(f"{sample_seed}:{time.time()}:{secrets.token_hex(8)}".encode("utf-8")).hexdigest()[:24]
    return {
        "sample_id": sample_id,
        "schema_version": str(clean.get("schema_version") or SAMPLE_SCHEMA_VERSION)[:64],
        "app_version": str(clean.get("app_version") or "")[:80],
        "client_version": str(clean.get("client_version") or clean.get("app_version") or "")[:80],
        "question_version": str(clean.get("question_version") or "")[:80],
        "prompt_version": str(clean.get("prompt_version") or "")[:80],
        "source_locale": str(clean.get("source_locale") or ai.get("analysis_locale") or "")[:32],
        "analysis_status": analysis_status,
        "final_type": final_type,
        "traditional_type": traditional_type,
        "ai_type": ai_type,
        "answer_quality_score": _safe_int(ai.get("answer_quality_score"), 0),
        "quality_flags": quality_flags if isinstance(quality_flags, dict) else {},
        "consent_scope": "anonymous_research",
        "payload": clean,
    }


SAMPLE_OPTIONAL_METADATA_COLUMNS = {"client_version", "source_locale", "analysis_status", "quality_flags"}


def _legacy_sample_row(row):
    return {key: value for key, value in row.items() if key not in SAMPLE_OPTIONAL_METADATA_COLUMNS}


def _looks_like_missing_sample_metadata_columns(body):
    text = json.dumps(body, ensure_ascii=False) if isinstance(body, (dict, list)) else str(body or "")
    return "persona_response_samples" in text and any(column in text for column in SAMPLE_OPTIONAL_METADATA_COLUMNS)


def _sample_type_family(type_code):
    code = str(type_code or "").upper()[:4]
    if code in {"INTJ", "INTP", "ENTJ", "ENTP"}:
        return "Analysts"
    if code in {"INFJ", "INFP", "ENFJ", "ENFP"}:
        return "Diplomats"
    if code in {"ISTJ", "ISFJ", "ESTJ", "ESFJ"}:
        return "Sentinels"
    if code in {"ISTP", "ISFP", "ESTP", "ESFP"}:
        return "Explorers"
    return "Unknown"


def _sample_quality_bucket(score):
    value = _safe_int(score, 0)
    if value >= 75:
        return "high"
    if value >= 50:
        return "medium"
    if value > 0:
        return "low"
    return "unknown"


def _summarize_studio_samples(rows):
    by_type = {}
    by_family = {}
    by_quality = {"high": 0, "medium": 0, "low": 0, "unknown": 0}
    by_storage = {}
    by_status = {}
    flag_counts = {}
    recent_low = []
    quality_values = []
    for row in rows:
        final_type = row.get("final_type") or row.get("ai_type") or row.get("traditional_type") or "unknown"
        family = _sample_type_family(final_type)
        quality = _safe_int(row.get("answer_quality_score"), 0)
        bucket = _sample_quality_bucket(quality)
        status = row.get("analysis_status") or (row.get("payload") or {}).get("analysis_status") or "unknown"
        flags = row.get("quality_flags")
        if not isinstance(flags, dict):
            flags = ((row.get("payload") or {}).get("ai") or {}).get("quality_flags") or (row.get("payload") or {}).get("quality_flags") or {}
        for flag, count in (flags.get("flag_counts") or {}).items():
            flag_counts[flag] = flag_counts.get(flag, 0) + _safe_int(count, 0)
        by_type[final_type] = by_type.get(final_type, 0) + 1
        by_family[family] = by_family.get(family, 0) + 1
        by_quality[bucket] = by_quality.get(bucket, 0) + 1
        storage = row.get("storage") or "supabase"
        by_storage[storage] = by_storage.get(storage, 0) + 1
        by_status[status] = by_status.get(status, 0) + 1
        if quality:
            quality_values.append(quality)
        if bucket in {"low", "unknown"}:
            recent_low.append({
                "sample_id": row.get("sample_id") or row.get("id") or "",
                "final_type": final_type,
                "quality": quality,
                "analysis_status": status,
                "flags": flags.get("flag_counts") or {},
                "storage": storage,
                "created_at": row.get("created_at", ""),
            })
    top_types = sorted(by_type.items(), key=lambda item: item[1], reverse=True)[:8]
    return {
        "total": len(rows),
        "averageQuality": round(sum(quality_values) / len(quality_values)) if quality_values else 0,
        "byType": [{"type": key, "count": value} for key, value in top_types],
        "byFamily": by_family,
        "byQuality": by_quality,
        "byStorage": by_storage,
        "byStatus": by_status,
        "flagCounts": flag_counts,
        "recentLowQuality": recent_low[:8],
    }


def _collect_studio_samples(limit=300):
    status, body = list_rows("persona_response_samples", order="created_at.desc", limit=limit)
    if status < 300 and isinstance(body, list):
        return [{**item, "storage": item.get("storage") or "supabase"} for item in body], ""
    error = body.get("error", "Unable to read Supabase samples") if isinstance(body, dict) else "Unable to read Supabase samples"
    return [], error


def _content_specs():
    return {
        "persona-types": {
            "table": "persona_types",
            "order": "type_code.asc",
            "fields": {"type_code", "display_name", "short_description", "long_description", "keywords_json", "strengths_json", "risks_json"},
            "defaults": {"keywords_json": [], "strengths_json": [], "risks_json": []},
        },
        "prompt-versions": {
            "table": "prompt_versions",
            "order": "created_at.desc",
            "fields": {"name", "version", "purpose", "prompt_text", "schema_json", "is_active"},
            "defaults": {"schema_json": {}, "is_active": False},
        },
        "visual-presets": {
            "table": "persona_visual_presets",
            "order": "type_code.asc",
            "fields": {"type_code", "palette_json", "motifs_json", "dot_matrix_params_json", "anime_style_params_json", "background_field_params_json"},
            "defaults": {"palette_json": [], "motifs_json": [], "dot_matrix_params_json": {}, "anime_style_params_json": {}, "background_field_params_json": {}},
        },
    }


def _sanitize_content_payload(resource, payload, partial=False):
    spec = _content_specs()[resource]
    data = dict(spec.get("defaults", {})) if not partial else {}
    for key in spec["fields"]:
        if key in payload:
            data[key] = payload[key]
    return data


STUDIO_DEFAULT_VISUAL_PRESET = {
    "palette": ["#DDEEE6", "#E8E3F4", "#2F8F72", "#6F5FA8"],
    "motifs": ["mirror", "signal", "field"],
    "temperament": "warm exploratory",
    "dotMatrixParams": {"baseDensity": 0.64, "contrast": 0.58, "softness": 0.74},
    "animeInspiredParams": {"silhouetteType": "soft-forward", "eyeEnergy": 0.66, "posture": "leaning toward signal"},
    "backgroundFieldParams": {"drift": 0.26, "refraction": 0.38},
    "iconography": ["lens", "ray", "field"],
    "resultCardLayoutHints": {"emphasis": "portrait-first"},
}


STUDIO_PROMPT_CALL1_TEMPLATE = """你是MBTI人格分析专家。分析一位{type}型人格的开放题回答，输出JSON。

传统量表结果：{type}
维度得分：
{dimension_summary}

回答内容：
{answers_text}

要求：
- 通篇用「你」称呼对方，不要用「用户」
- 引用原话时直接加引号，不要标注Q1/Q2等编号
- 核心任务是验证为什么对方确实是{type}型，同时指出开放题里出现的张力
- 从认知功能角度分析，但用F/T/N/S等普通用户可读的方向字母，不要堆Fe/Ni缩写
- 使用心理学、认知科学术语但自然融入
- 使用中文标点符号

请输出JSON，不要markdown代码块：
{
  "analysis_summary": "400~600字深度分析",
  "dimension_analysis": {
    "EI": {"倾向":"E/I","confidence":0-100,"evidence":"引用原话","分析":"100~180字认知功能分析"},
    "SN": {"倾向":"S/N","confidence":0-100,"evidence":"引用原话","分析":"100~180字认知功能分析"},
    "TF": {"倾向":"T/F","confidence":0-100,"evidence":"引用原话","分析":"100~180字认知功能分析"},
    "JP": {"倾向":"J/P","confidence":0-100,"evidence":"引用原话","分析":"100~180字认知功能分析"},
    "AT": {"倾向":"A/T","confidence":0-100,"evidence":"引用原话","分析":"100~180字认知功能分析"}
  },
  "agreement": "high/medium/low",
  "agreement_details": {"matching_dims":[],"differing_dims":[],"explanation":"解释一致与差异"},
  "differences": [],
  "strengths": [],
  "growth_areas": [],
  "career_hints": [],
  "core_tension": "80字以内，为你的焦虑或困境精准命名",
  "verdicts": {"EI":"✅","SN":"✅","TF":"⚠️","JP":"✅","AT":"?"}
}

关于verdicts：根据开放题内容对每个维度做独立判断，不要照抄量表倾向。✅=支持量表倾向，⚠️=存在张力，?=信息不足。每个维度都要写，不要全部写✅。"""


STUDIO_PROMPT_CALL2_TEMPLATE = """你是一位温暖有洞察力的心理学家兼作家。请为一位{type}型的人撰写两份文字。

素材：
{analysis_context}

请直接输出两段内容：

一、整体气质画像
写一段180~260字的画像。要像一个敏锐的人在认真看见对方，而不是模板化夸奖。可以使用比喻，但必须贴合素材。不要提及“系统”“模型”“量表算法”。

二、悄悄话
写一段120~180字的安抚性文字。语气克制、真诚、像私下递给对方的一句话。不要鸡汤，不要过度承诺，不要治疗化。

要求：
- 全文用「你」
- 中文标点
- 不要markdown列表
- 不要解释写作过程
- 不要加入与素材无关的类型刻板印象"""


def score_traditional(answers):
    net_scores = {}
    for dim in DIM_ORDER:
        dim_qs = [q for q in questions_data.get("traditional", []) if q["dimension"] == dim]
        net = 0
        first, second = DIM_POLES[dim]
        for q in dim_qs:
            match = [a for a in answers if a["id"] == q["id"]]
            if not match: continue
            try:
                val = int(match[0]["value"])
            except (TypeError, ValueError):
                val = 0
            val = max(-3, min(3, val))
            net += val if q["direction"] == first else -val
        possible_max = len(dim_qs) * 3
        dominant = first if net >= 0 else second
        other = second if net >= 0 else first
        intensity = min(abs(net) / possible_max * 100, 100) if possible_max else 50
        dom_pct = round(50 + abs(net) / possible_max * 50) if possible_max else 50
        other_pct = 100 - dom_pct
        net_scores[dim] = {
            "net": net, "dominant": dominant, "other": other,
            "intensity": round(intensity),
            "strength": "neutral" if intensity < 20 else ("slight" if intensity < 60 else "clear"),
            "dom_pct": dom_pct, "other_pct": other_pct,
        }
    type_str = "".join(net_scores[d]["dominant"] for d in DIM_ORDER[:4])
    identity = net_scores["AT"]["dominant"]
    confidence = build_type_confidence(net_scores)
    candidates = build_candidate_types(net_scores)
    return {"type": type_str, "identity": identity, "details": net_scores, "confidence": confidence, "candidate_types": candidates}


def build_type_confidence(net_scores):
    uncertain = []
    pct_values = []
    for dim in DIM_ORDER:
        d = net_scores.get(dim, {})
        dom_pct = int(d.get("dom_pct", 50))
        pct_values.append(dom_pct)
        closeness = abs(dom_pct - 50)
        if dom_pct < 58:
            label = "low"
        elif dom_pct < 68:
            label = "medium"
        else:
            label = "high"
        if label != "high":
            uncertain.append({
                "dim": dim,
                "dominant": d.get("dominant", ""),
                "other": d.get("other", ""),
                "dom_pct": dom_pct,
                "other_pct": d.get("other_pct", 100 - dom_pct),
                "label": label,
                "closeness": closeness,
            })
    avg = sum(pct_values) / len(pct_values) if pct_values else 50
    level = "high" if avg >= 72 and not uncertain else ("medium" if avg >= 62 else "low")
    return {
        "level": level,
        "score": round(avg),
        "uncertain_dimensions": sorted(uncertain, key=lambda item: item["dom_pct"]),
    }


def candidate_confidence(letters, identity, net_scores):
    values = []
    for index, dim in enumerate(DIM_ORDER[:4]):
        d = net_scores.get(dim, {})
        values.append(int(d.get("dom_pct" if letters[index] == d.get("dominant") else "other_pct", 50)))
    at = net_scores.get("AT", {})
    values.append(int(at.get("dom_pct" if identity == at.get("dominant") else "other_pct", 50)))
    return round(sum(values) / len(values)) if values else 50


def build_candidate_types(net_scores):
    base_letters = [net_scores[d]["dominant"] for d in DIM_ORDER[:4]]
    base_identity = net_scores["AT"]["dominant"]
    borderline = []
    for index, dim in enumerate(DIM_ORDER[:4]):
        d = net_scores.get(dim, {})
        dom_pct = int(d.get("dom_pct", 50))
        if dom_pct < 68:
            borderline.append((abs(dom_pct - 50), index, dim))
    borderline.sort(key=lambda item: item[0])
    identity_borderline = int(net_scores.get("AT", {}).get("dom_pct", 50)) < 68
    candidates = []
    seen = set()

    def add_candidate(letters, identity, flipped_dims, reason):
        type_code = "".join(letters)
        key = f"{type_code}-{identity}"
        if key in seen:
            return
        seen.add(key)
        candidates.append({
            "type": type_code,
            "identity": identity,
            "confidence": candidate_confidence(letters, identity, net_scores),
            "flipped_dimensions": flipped_dims,
            "reason": reason,
        })

    add_candidate(base_letters, base_identity, [], "量表最接近")
    for _, index, dim in borderline[:3]:
        letters = base_letters[:]
        letters[index] = net_scores[dim]["other"]
        add_candidate(letters, base_identity, [dim], f"{dim} 接近中线")
    if identity_borderline:
        add_candidate(base_letters, net_scores["AT"]["other"], ["AT"], "A/T 接近中线")
    if len(borderline) >= 2:
        letters = base_letters[:]
        dims = []
        for _, index, dim in borderline[:2]:
            letters[index] = net_scores[dim]["other"]
            dims.append(dim)
        add_candidate(letters, base_identity, dims, "多个临界维度同时接近")
    primary = candidates[:1]
    rest = sorted(candidates[1:], key=lambda item: item.get("confidence", 0), reverse=True)
    return (primary + rest)[:4]


def select_open_ended(details):
    pool = list(questions_data.get("open_ended_pool", []))
    if not pool: return []
    random.shuffle(pool)
    selected, used_ids = [], set()
    def pick_one(tag, focus_dim=None, reason=""):
        for q in pool:
            if tag in q.get("tags", []) and q["id"] not in used_ids:
                item = dict(q)
                if focus_dim: item["focus_dimension"] = focus_dim
                if reason: item["selection_reason"] = reason
                selected.append(item); used_ids.add(q["id"])
                return True
        return False
    uncertainty, stable_dims = [], []
    for dim in DIM_ORDER:
        d = details.get(dim, {})
        dom_pct = int(d.get("dom_pct", 50))
        closeness = abs(dom_pct - 50)
        if dom_pct < 68:
            uncertainty.append((closeness, dim, dom_pct))
        else:
            stable_dims.append((closeness, dim, dom_pct))
    uncertainty.sort(key=lambda x: x[0])
    for _, dim, dom_pct in uncertainty:
        if len([q for q in selected if q.get("selection_bucket") == "borderline"]) >= 3:
            break
        before = len(selected)
        pick_one(f"probe_{dim}", dim, f"{dim} 接近中线（{dom_pct}%），优先用现实场景复核")
        if len(selected) > before:
            selected[-1]["selection_bucket"] = "borderline"
    if len(selected) < 5:
        before = len(selected)
        pick_one("mixed", reason="跨维度困境题，用来观察多个倾向在同一场景里的取舍")
        if len(selected) > before:
            selected[-1]["selection_bucket"] = "mixed"
    if len(selected) < 5:
        before = len(selected)
        pick_one("emotion_story", reason="情绪与自我叙事题，用来补充压力、自责或关系中的真实反应")
        if len(selected) > before:
            selected[-1]["selection_bucket"] = "narrative"
    if len(selected) < 5 and not any(q.get("selection_bucket") == "narrative" for q in selected):
        before = len(selected)
        pick_one("narrative", reason="叙事题，用来补充具体经历而不是抽象自评")
        if len(selected) > before:
            selected[-1]["selection_bucket"] = "narrative"
    if len(selected) < 5:
        stable_dims.sort(key=lambda x: x[0])
        for _, dim, dom_pct in stable_dims:
            if len(selected) >= 5:
                break
            before = len(selected)
            pick_one(f"probe_{dim}", dim, f"{dim} 量表较稳定（{dom_pct}%），抽样检查压力场景下是否仍一致")
            if len(selected) > before:
                selected[-1]["selection_bucket"] = "stability_check"
    if len(selected) < 5:
        for q in pool:
            if q["id"] not in used_ids:
                item = dict(q)
                item["selection_reason"] = "补足 5 道开放题"
                item["selection_bucket"] = "fallback"
                selected.append(item); used_ids.add(q["id"])
                if len(selected) >= 5: break
    return [
        {"display_id": f"oe_{i+1}", "id": q["id"], "text": q["text"],
         "hint": q.get("hint", ""), "focus_dimension": q.get("focus_dimension", ""),
         "tags": q.get("tags", []), "selection_reason": q.get("selection_reason", ""),
         "selection_bucket": q.get("selection_bucket", "")}
        for i, q in enumerate(selected[:5])
    ]


def call_ai(system_prompt, user_prompt, retries=2, temperature=0.3, max_tokens=4096):
    if not AI_API_KEY:
        raise ValueError("AI API Key 未设置。请在 Vercel 环境变量中配置 AI_API_KEY。")
    import urllib.request
    messages = []
    if system_prompt and system_prompt.strip():
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_prompt})
    payload = json.dumps({
        "model": AI_MODEL, "messages": messages,
        "temperature": temperature, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(AI_URL, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header(AI_AUTH_HEADER, f"Bearer {AI_API_KEY}")
    last_error = None
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, dict):
                if data.get("choices"):
                    return data["choices"][0]["message"]["content"]
                if data.get("result"):
                    return data["result"]
            return json.dumps(data, ensure_ascii=False)
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"AI API 错误: {e.read().decode('utf-8', errors='replace')}")
        except urllib.error.URLError as e:
            last_error = e
            if attempt < retries: time.sleep(1)
    raise RuntimeError(f"网络错误: {last_error}")


def _open_answer_signal(text):
    raw = str(text or "").strip()
    compact = re.sub(r"\s+", "", raw).lower()
    chars = _OPEN_SIGNAL_RE.findall(compact)
    signal = len(chars)
    dominance = max((chars.count(char) for char in set(chars)), default=0) / signal if signal else 0
    max_run = 0
    run = 0
    last = ""
    for char in compact:
        if char == last:
            run += 1
        else:
            last = char
            run = 1
        max_run = max(max_run, run)
    repeated = bool(_OPEN_REPEAT_RE.search(compact))
    scene = bool(_OPEN_SCENE_RE.search(raw))
    cause = bool(_OPEN_CAUSE_RE.search(raw))
    choice = bool(_OPEN_CHOICE_RE.search(raw))
    emotion = bool(_OPEN_EMOTION_RE.search(raw))
    time_marker = bool(_OPEN_TIME_RE.search(raw))
    punct = bool(re.search(r"[，。！？；,.!?;]", raw))
    latin_run = bool(re.fullmatch(r"[a-z']{18,}", compact, re.IGNORECASE))
    score = min(62, round(signal / 180 * 58))
    if scene: score += 24
    if cause: score += 7
    if choice: score += 7
    if emotion: score += 6
    if time_marker: score += 5
    if punct and signal > 45: score += 8
    if signal > 90: score += 8
    if max_run >= 5: score -= 35
    if repeated: score -= 35
    if dominance > 0.42 and signal > 12: score -= 30
    if latin_run and not scene: score -= 24
    if signal < 24: score = min(score, 24)
    flags = []
    if scene: flags.append("scene")
    if cause: flags.append("cause")
    if choice: flags.append("choice")
    if emotion: flags.append("emotion")
    if time_marker: flags.append("time")
    if punct: flags.append("sentence")
    if repeated: flags.append("repeated_pattern")
    if max_run >= 6: flags.append("long_repeat")
    if dominance > 0.48 and signal > 12: flags.append("character_dominance")
    if latin_run and not scene: flags.append("single_token_text")
    return {
        "score": max(0, min(100, score)),
        "signal": signal,
        "dominance": dominance,
        "max_run": max_run,
        "repeated": repeated,
        "has_scene": scene,
        "has_cause": cause,
        "has_choice": choice,
        "has_emotion": emotion,
        "has_time": time_marker,
        "flags": flags,
        "low_info": signal < 36 or dominance > 0.48 or max_run >= 6 or repeated or (latin_run and not scene),
    }


def is_nonsense(text):
    raw = str(text or "").strip()
    if not raw or _NONSENSE_RE.search(raw): return True
    if all(not c.isalnum() for c in raw): return True
    signal = _open_answer_signal(raw)
    return signal["low_info"] or signal["score"] < 25


def _review_open_answer_quality(open_answers):
    reviewed = []
    for item in open_answers:
        answer = str((item or {}).get("answer", "")).strip()
        if not answer: continue
        signal = _open_answer_signal(answer)
        reviewed.append((item, signal))
    valid = [
        item for item, signal in reviewed
        if not signal["low_info"] and signal["score"] >= 45 and signal["signal"] >= 36
    ]
    total_signal = sum(signal["signal"] for _, signal in reviewed)
    average_score = round(sum(signal["score"] for _, signal in reviewed) / len(reviewed)) if reviewed else 0
    flag_counts = {}
    item_summaries = []
    for item, signal in reviewed:
        for flag in signal.get("flags", []):
            flag_counts[flag] = flag_counts.get(flag, 0) + 1
        item_summaries.append({
            "id": (item or {}).get("display_id") or (item or {}).get("id") or "",
            "score": signal["score"],
            "signal": signal["signal"],
            "flags": signal.get("flags", []),
            "low_info": signal["low_info"],
        })
    return {
        "ok": len(valid) >= 2 and average_score >= 45 and total_signal >= 120,
        "valid_answers": valid,
        "valid_count": len(valid),
        "total_count": len(reviewed),
        "average_score": average_score,
        "total_signal": total_signal,
        "quality_flags": {
            "valid_count": len(valid),
            "total_count": len(reviewed),
            "average_score": average_score,
            "total_signal": total_signal,
            "flag_counts": flag_counts,
            "items": item_summaries,
        },
    }


def _fallback_analysis(traditional_type, identity, details, open_answers, quality_review=None):
    """Generate a fallback analysis from profile data when DeepSeek is unreachable."""
    full_type = f"{traditional_type}-{identity}"
    profile = questions_data.get("type_profiles", {}).get(traditional_type, {})
    dim_names = {"EI": "精力来源", "SN": "认知方式", "TF": "决策方式", "JP": "生活态度", "AT": "身份认同"}

    dim_analysis = {}
    for dim in DIM_ORDER:
        d = details.get(dim, {})
        dom = d.get("dominant", "?")
        pct = d.get("dom_pct", 50)
        meta = dim_names.get(dim, dim)
        label = "明显偏向" if pct > 70 else ("轻微偏向" if pct > 55 else "接近居中")
        verdict = "confirmed" if pct > 65 else ("tension" if pct > 50 else "insufficient")
        dim_analysis[dim] = {
            "倾向": dom,
            "verdict": verdict,
            "confidence": min(pct + 10, 95),
            "evidence": f"传统量表数据显示你在该维度偏向 {dom}（{pct}%），属于「{label}」。",
            "分析": f"基于量表统计，你在 {meta}（{dim}）维度上表现出 {dom} 倾向。" + ("这一倾向较为明显。" if pct > 60 else "但并非极端，在不同情境下可能有所变化。")
        }

    return {
        "portrait": "",
        "insight_title": "AI 深度解读",
        "insight": f"基于传统量表数据，你的类型为 {full_type}。由于 AI 深度分析服务暂不可用，以下分析基于统计数据和类型特征生成，仅供参考。完成开放题后再次提交可获得更精准的个性化解读。",
        "secret_letter_title": f"给{full_type}的你 的悄悄话",
        "secret_letter": "MBTI 只是一个帮助我们了解自己倾向的工具，它描述的是偏好而非能力，是倾向而非定论。",
        "agreement": "medium",
        "ai_available": False,
        "is_fallback": True,
        "analysis_status": "fallback",
        "ai_confidence": 60,
        "answer_quality_score": _safe_int((quality_review or {}).get("average_score"), 50) or 50,
        "quality_flags": (quality_review or {}).get("quality_flags", {}),
        "insufficient_evidence_dims": [],
        "differences": ["AI 深度分析暂不可用，无法对比差异。请稍后重试或检查 API 配置。"],
        "dimension_analysis": dim_analysis,
        "strengths": (profile.get("strengths") or [])[:4] or ["暂无数据"],
        "growth_areas": (profile.get("weaknesses") or [])[:3] or ["暂无数据"],
        "career_hints": (profile.get("careers") or [])[:6] or [],
        "follow_up_questions": [
            "尝试描述一个最近让你感到困扰或兴奋的具体场景？",
            "你在团队中通常扮演什么角色？",
            "什么情况下你会觉得最有成就感？"
        ],
    }


def _analyze_with_deepseek(traditional_type, identity, details, open_answers):
    """Split into two calls: first generates long insight text, second generates structured JSON."""
    dim_names = {"EI": "精力来源", "SN": "认知方式", "TF": "决策方式", "JP": "生活态度", "AT": "身份认同"}
    dim_desc = []
    for dim in DIM_ORDER:
        d = details.get(dim, {})
        dom = d.get("dominant", "?")
        pct = d.get("dom_pct", 50)
        strength = d.get("strength", "")
        dim_desc.append(f"- {dim_names.get(dim, dim)} ({dim}): {dom} {pct}% ({strength})")

    full_type = f"{traditional_type}-{identity}"
    answers_text = "\n".join(
        f"Q{oa.get('display_id', i+1)}: {oa.get('text', '')}\n回答: {oa.get('answer', '')}"
        for i, oa in enumerate(open_answers)
        if oa.get("answer", "").strip()
    )

    # ====== CALL 1: Generate analysis summary & structured data ======
    call1_prompt = f"""你是MBTI人格分析专家。分析一位{full_type}型人格的开放题回答，输出JSON。

传统量表结果：{full_type}
维度得分：
{chr(10).join(dim_desc)}

回答内容：
{answers_text if answers_text else "（未填写）"}

要求：
- 通篇用「你」称呼对方，不要用「用户」
- 引用原话时直接加引号（如"我当时的感受是…"），不要标注Q1/Q2等编号
- 核心任务是验证为什么对方确实是{full_type}型——回答中哪些思维模式、情绪反应、行为倾向印证了各维度
- 从认知功能角度分析（用F/T/N/S等方向字母，不要Fe/Ni这类缩写，方便普通用户理解）
- 使用心理学、认知科学术语但自然融入，不堆砌
- 使用中文标点符号

请输出JSON，不要markdown代码块：
{{
  "analysis_summary": "400~600字深度分析。以「你」称呼，引用原话（不加编号），从认知功能角度（用F/T/N/S等方向字母，不用Fe/Ni缩写）解读行为模式，论证各维度倾向的真实性。要有温度和洞察力。",
  "dimension_analysis": {{
    "EI": {{"倾向":"E/I","confidence":0-100,"evidence":"引用原话（不加编号）","分析":"100~180字认知功能分析"}},
    "SN": {{"倾向":"S/N","confidence":0-100,"evidence":"引用原话（不加编号）","分析":"100~180字认知功能分析"}},
    "TF": {{"倾向":"T/F","confidence":0-100,"evidence":"引用原话（不加编号）","分析":"100~180字认知功能分析"}},
    "JP": {{"倾向":"J/P","confidence":0-100,"evidence":"引用原话（不加编号）","分析":"100~180字认知功能分析"}},
    "AT": {{"倾向":"A/T","confidence":0-100,"evidence":"引用原话（不加编号）","分析":"100~180字认知功能分析"}}
  }},
  "agreement": "high/medium/low",
  "agreement_details": {{"matching_dims":[],"differing_dims":[],"explanation":"解释一致与差异"}},
  "differences": [],
  "strengths": [],
  "growth_areas": [],
  "career_hints": [],
  "core_tension": "80字以内，为你的焦虑或困境精准命名",
  "verdicts": {{"EI":"✅","SN":"✅","TF":"⚠️","JP":"✅","AT":"?"}}
}}

关于verdicts：根据开放题内容对每个维度做独立判断，不要照抄量表倾向。✅=支持量表倾向，⚠️=存在张力，?=信息不足。每个维度都要写，不要全部写✅。"""

    print(f"[AI] Call 1: generating analysis data...", file=sys.stderr)
    raw1 = call_ai("", call1_prompt, temperature=0.5, max_tokens=4096)
    raw1 = raw1.strip()
    if raw1.startswith("```"):
        raw1 = raw1.split("\n", 1)[-1]
        raw1 = raw1.rsplit("```", 1)[0]

    # Parse JSON
    import re as _re
    parsed = {}
    try:
        parsed = json.loads(raw1)
    except json.JSONDecodeError:
        brace_start = raw1.find("{")
        brace_end = raw1.rfind("}")
        if brace_start != -1 and brace_end > brace_start:
            try:
                parsed = json.loads(raw1[brace_start:brace_end + 1])
            except:
                pass

    analysis_summary = parsed.get("analysis_summary", "")
    dim_analysis = parsed.get("dimension_analysis", {})
    # Ensure all 5 dimensions exist
    for dim in DIM_ORDER:
        if dim not in dim_analysis or not isinstance(dim_analysis[dim], dict):
            dim_analysis[dim] = {"倾向": "", "confidence": 60, "evidence": "", "分析": ""}

    # ====== CALL 2: Portrait + Letter ======
    letter_context = f"分析摘要：{analysis_summary[:400]}" if analysis_summary else ""
    call2_prompt = f"""你是一位温暖有洞察力的心理学家兼作家。请为一位{full_type}型的人撰写两份文字。

{letter_context}

对方自己的话：
{answers_text if answers_text else "（未填写）"}

请按以下结构输出，用「你」称呼。不要标题。

一、整体气质画像（150~250字）
画一幅人物速写像：你说话做事像什么？给人什么感觉？像一种什么场景、物件或声音？
先描绘画像，再点出藏在画像里的矛盾。
用短句、断句、意象堆叠——像一段诗意的意识流，让人「看见人」。
用有节奏的标点（句号、逗号、破折号）控制呼吸感，不要全程无标点。

二、悄悄话（300~600字）
用文学性和心理洞察写出最需要被理解的部分。
引用对方原话1-2处（直接用引号，不要标编号）。
语气像一位懂你的朋友——温暖、坦诚、不评判。
直接以内容开头。"""

    print(f"[AI] Call 2: portrait + letter…", file=sys.stderr)
    raw2 = call_ai("", call2_prompt, temperature=0.7, max_tokens=2048)
    raw2 = raw2.strip()
    if raw2.startswith("```"):
        raw2 = raw2.split("\n", 1)[-1]
        raw2 = raw2.rsplit("```", 1)[0]

    # Parse portrait and letter from Call 2
    import re
    portrait = ""
    letter = ""

    profile_marker = "整体气质画像"
    letter_marker = "悄悄话"

    profile_pos = raw2.find(profile_marker)
    letter_pos = raw2.find(letter_marker)

    if profile_pos >= 0:
        content_start = profile_pos + len(profile_marker)
        nl = raw2.find("\n", content_start)
        if nl != -1:
            content_start = nl + 1
        if letter_pos >= 0:
            portrait = raw2[content_start:letter_pos].strip()
        else:
            portrait = raw2[content_start:].strip()

    if letter_pos >= 0:
        letter_start = letter_pos + len(letter_marker)
        nl2 = raw2.find("\n", letter_start)
        if nl2 != -1:
            letter_start = nl2 + 1
        letter = raw2[letter_start:].strip()

    # Clean up portrait
    def _strip_md(s):
        return re.sub(r'^#{1,6}\s+', '', s, flags=re.MULTILINE).strip()

    portrait = _strip_md(portrait)
    portrait = re.sub(r'\*{2,}', '', portrait).strip()
    portrait = re.sub(r'^[一二][、.．]?\s*整体气质画像\s*', '', portrait).strip()
    portrait = re.sub(r'\n+#{0,4}\s*二[、.．].*$', '', portrait).strip()

    # Clean up letter
    letter = _strip_md(letter)
    letter = re.sub(r'\*{2,}', '', letter).strip()
    letter = re.sub(r'^[一二][、.．]?\s*悄悄话\s*', '', letter).strip()

    if not letter or len(letter) < 30:
        letter = ""
    if not portrait or len(portrait) < 30:
        portrait = analysis_summary[:200] if analysis_summary else ""

    # Extract core_tension and verdicts
    core_tension = parsed.get("core_tension", "")
    ai_verdicts = parsed.get("verdicts", {})

    # Build dimension_analysis with verdicts
    dim_verdicts = {}
    for dim in DIM_ORDER:
        v = ai_verdicts.get(dim, "?")
        if v == "✅":
            dim_verdicts[dim] = "confirmed"
        elif "⚠" in v:
            dim_verdicts[dim] = "tension"
        else:
            dim_verdicts[dim] = "insufficient"

    dim_analysis_with_verdicts = {}
    for dim in DIM_ORDER:
        ad = dim_analysis.get(dim, {})
        dom = details.get(dim, {}).get("dominant", "")
        verdict = dim_verdicts.get(dim, "insufficient")
        conf = 90 if verdict == "confirmed" else (70 if verdict == "tension" else 55)
        dim_analysis_with_verdicts[dim] = {
            "倾向": dom,
            "verdict": verdict,
            "confidence": conf,
            "evidence": ad.get("evidence", ""),
            "分析": ad.get("分析", ""),
        }

    # Build result
    full_type_full = f"{traditional_type}-{identity}"
    result = {
        "portrait": portrait,
        "insight": analysis_summary,
        "secret_letter_title": f"给{full_type_full}的你 的悄悄话",
        "secret_letter": letter,
        "insight_title": "AI 深度解读",
        "ai_type": parsed.get("ai_type", full_type_full),
        "ai_confidence": parsed.get("ai_confidence", 72),
        "answer_quality_score": parsed.get("answer_quality_score", 60),
        "dimension_analysis": dim_analysis_with_verdicts,
        "insufficient_evidence_dims": [d for d, v in ai_verdicts.items() if v == "?"],
        "follow_up_questions": parsed.get("follow_up_questions", []),
        "agreement": parsed.get("agreement", "high"),
        "agreement_details": parsed.get("agreement_details", {"matching_dims":[],"differing_dims":[],"explanation":""}),
        "differences": parsed.get("differences", []),
        "strengths": parsed.get("strengths", []),
        "growth_areas": parsed.get("growth_areas", []),
        "career_hints": parsed.get("career_hints", []),
        "core_tension": core_tension,
        "ai_available": True,
        "analysis_status": "ai_reviewed",
        "is_fallback": False,
    }

    print(f"[AI] Final: portrait={len(portrait)}c secret={len(letter)}c strengths={len(result['strengths'])} verdicts={dim_verdicts}", file=sys.stderr)
    return result


# ====== HTTP HANDLER ======
def analyze_with_ai(traditional_type, identity, details, open_answers):
    review = _review_open_answer_quality(open_answers)
    if not review["ok"]:
        raise ValueError("开放题信息量还不够，暂不进入 AI 分析。请至少补充 2 道包含真实场景、选择或想法过程的回答。")
    filtered = review["valid_answers"]
    try:
        result = _analyze_with_deepseek(traditional_type, identity, details, filtered)
        result["quality_flags"] = review["quality_flags"]
        result["analysis_status"] = "ai_reviewed"
        result["answer_quality_score"] = _safe_int(result.get("answer_quality_score"), review["average_score"]) or review["average_score"]
        return result
    except Exception as e:
        traceback.print_exc()
        return _fallback_analysis(traditional_type, identity, details, open_answers, review)


# ═══════════════════════════════════════════
#  Routes
# ═══════════════════════════════════════════

@app.route("/")
def handle_root():
    """Serve the frontend index.html."""
    index_html = TEMPLATES / "index.html"
    if index_html.exists():
        return index_html.read_text(encoding="utf-8"), 200, {"Content-Type": "text/html; charset=utf-8"}
    return f"FE not found: {index_html}", 404


@app.route("/typeme-app.css")
def handle_typeme_css():
    path = PUBLIC / "typeme-app.css"
    if path.exists():
        return path.read_text(encoding="utf-8"), 200, {"Content-Type": "text/css; charset=utf-8"}
    return "CSS not found", 404


@app.route("/typeme-app.js")
def handle_typeme_js():
    path = PUBLIC / "typeme-app.js"
    if path.exists():
        return path.read_text(encoding="utf-8"), 200, {"Content-Type": "application/javascript; charset=utf-8"}
    return "JS not found", 404


@app.route("/api/questions")
def handle_questions():
    return jsonify(questions_data)


@app.route("/api/samples", methods=["POST"])
def handle_sample_submit():
    raw = request.get_data(cache=False) or b""
    if len(raw) > SAMPLE_MAX_BODY_BYTES:
        return "Sample payload is too large", 413, {"Content-Type": "text/plain; charset=utf-8"}
    try:
        payload = json.loads(raw.decode("utf-8")) if raw else {}
        row = _sanitize_response_sample(payload)
    except UnicodeDecodeError:
        return "Sample payload must be UTF-8", 400, {"Content-Type": "text/plain; charset=utf-8"}
    except json.JSONDecodeError:
        return "Invalid sample JSON", 400, {"Content-Type": "text/plain; charset=utf-8"}
    except ValueError as exc:
        return str(exc), 400, {"Content-Type": "text/plain; charset=utf-8"}

    status, body = create_row("persona_response_samples", row)
    warning = ""
    if status >= 300 and _looks_like_missing_sample_metadata_columns(body):
        status, body = create_row("persona_response_samples", _legacy_sample_row(row))
        if status < 300:
            warning = "Supabase metadata columns are missing; stored using legacy sample shape."
    if status >= 300:
        detail = body if isinstance(body, dict) else {"error": "Supabase write failed"}
        return json_response({"ok": False, "error": "Supabase write failed", "detail": detail}, status)
    return json_response({"ok": True, "sample_id": row["sample_id"], "stored": "supabase", "warning": warning})


@app.route("/api/studio/auth/login", methods=["POST"])
def handle_studio_login():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    if not _studio_auth_configured():
        return json_response({
            "error": "Studio Auth is not configured",
            **_studio_state(),
        }, 503)
    if not email or not password:
        return json_response({"error": "Email and password are required"}, 400)

    status, auth = _supabase_auth_request("token?grant_type=password", {"email": email, "password": password})
    if status >= 300 or not isinstance(auth, dict):
        return json_response({"error": "Login failed", "detail": auth}, 401)
    user = auth.get("user") or {}
    auth_email = (user.get("email") or email).lower()
    if auth_email not in STUDIO_ADMIN_EMAILS:
        return json_response({"error": "This account is not allowed to access Studio", "email": auth_email}, 403)

    response = json_response({
        "authenticated": True,
        "email": auth_email,
        "isAdmin": True,
        "dbConfigured": is_db_enabled(),
    })
    _set_studio_cookie(response, STUDIO_COOKIE_ACCESS, _sign_token(auth.get("access_token", "")))
    _set_studio_cookie(response, STUDIO_COOKIE_REFRESH, _sign_token(auth.get("refresh_token", "")))
    return response


@app.route("/api/studio/auth/logout", methods=["POST"])
def handle_studio_logout():
    response = json_response({"ok": True})
    _clear_studio_cookies(response)
    return response


@app.route("/api/studio/auth/me")
def handle_studio_me():
    _, state, refresh_response = _studio_user_with_refresh()
    if refresh_response is not None and state.get("authenticated"):
        return refresh_response
    return json_response(state)


@app.route("/api/studio/dev-access")
def handle_studio_dev_access():
    _, state, error_response = _require_studio_admin()
    if error_response:
        return error_response
    return json_response({"allowed": True, "reason": "Studio admin session", "loginUrl": "/studio", **state})


@app.route("/api/studio/health")
def handle_studio_health():
    _, state, error_response = _require_studio_admin()
    if error_response:
        return error_response
    qi = questions_data or {}
    return json_response({
        "status": "ok",
        "mode": "studio",
        "questions": {
            "scale": len(qi.get("traditional", [])),
            "open": len(qi.get("open_ended_pool", [])),
            "personaTypes": len(qi.get("type_profiles", {})),
        },
        "dbConfigured": is_db_enabled(),
        "aiConfigured": _studio_ai_configured(),
        "authConfigured": _studio_auth_configured(),
        "localAuthConfigured": False,
        "adminEmailsConfigured": bool(STUDIO_ADMIN_EMAILS),
        "email": state.get("email", ""),
    })


@app.route("/api/studio/dashboard")
def handle_studio_dashboard():
    _, _, error_response = _require_studio_admin()
    if error_response:
        return error_response
    qi = questions_data or {}
    samples, db_error = _collect_studio_samples(300)
    content = {}
    content_errors = {}
    for resource, spec in _content_specs().items():
        status, body = list_rows(spec["table"], columns="id", order=spec["order"], limit=1000)
        if status < 300 and isinstance(body, list):
            content[resource] = len(body)
        else:
            content[resource] = 0
            if status != 503:
                content_errors[resource] = body.get("error", "Unable to read rows") if isinstance(body, dict) else "Unable to read rows"
    return json_response({
        "status": "ok",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "config": {
            "dbConfigured": is_db_enabled(),
            "aiConfigured": _studio_ai_configured(),
            "authConfigured": _studio_auth_configured(),
            "localAuthConfigured": False,
            "adminEmailsConfigured": bool(STUDIO_ADMIN_EMAILS),
        },
        "questions": {
            "scale": len(qi.get("traditional", [])),
            "open": len(qi.get("open_ended_pool", [])),
            "typeProfiles": len(qi.get("type_profiles", {})),
            "dimensions": len(qi.get("dimensions", [])),
        },
        "content": content,
        "contentErrors": content_errors,
        "samples": _summarize_studio_samples(samples),
        "dbError": db_error,
    })


@app.route("/api/studio/env")
def handle_studio_env():
    _, _, error_response = _require_studio_admin()
    if error_response:
        return error_response
    safe = {
        key: value for key, value in os.environ.items()
        if not any(part in key.lower() for part in ["key", "secret", "token", "password", "auth"])
    }
    qi = questions_data or {}
    return json_response({
        "cwd": os.getcwd(),
        "python": sys.version,
        "safe_env_keys": sorted(safe.keys()),
        "hasQuestions": bool(questions_data),
        "questions": {
            "scale": len(qi.get("traditional", [])),
            "open": len(qi.get("open_ended_pool", [])),
            "personaTypes": len(qi.get("type_profiles", {})),
        },
        "dimensions": qi.get("dimensions", []),
        "dbConfigured": is_db_enabled(),
        "aiConfigured": _studio_ai_configured(),
        "aiBackend": "deepseek",
        "aiModel": AI_MODEL,
    })


@app.route("/api/studio/prompts")
def handle_studio_prompts():
    _, _, error_response = _require_studio_admin()
    if error_response:
        return error_response
    return json_response({
        "call1": {
            "name": "_analyze_with_deepseek Call 1",
            "source_file": "api/index.py",
            "purpose": "Generate structured JSON analysis from scale details and open answers.",
            "template": STUDIO_PROMPT_CALL1_TEMPLATE,
            "temperature": 0.5,
            "max_tokens": 4096,
        },
        "call2": {
            "name": "_analyze_with_deepseek narrative composition",
            "source_file": "api/index.py",
            "purpose": "Generate public-facing TypeMe result narrative from structured analysis.",
            "template": STUDIO_PROMPT_CALL2_TEMPLATE,
            "temperature": 0.7,
            "max_tokens": 2048,
        },
    })


@app.route("/api/studio/logs")
def handle_studio_logs():
    _, _, error_response = _require_studio_admin()
    if error_response:
        return error_response
    rows = []
    db_error = ""
    status, body = list_rows(
        "analysis_logs",
        columns="id,created_at,event_type,message,latency_ms,metadata_json",
        order="created_at.desc",
        limit=200,
    )
    if status < 300 and isinstance(body, list):
        rows = body
    else:
        db_error = body.get("error", "Unable to read analysis logs") if isinstance(body, dict) else "Unable to read analysis logs"
    by_event = {}
    latency_values = []
    for row in rows:
        event_type = row.get("event_type") or "unknown"
        by_event[event_type] = by_event.get(event_type, 0) + 1
        latency = row.get("latency_ms")
        if isinstance(latency, (int, float)):
            latency_values.append(latency)
    return json_response({
        "rows": rows,
        "summary": {
            "total": len(rows),
            "byEvent": by_event,
            "averageLatencyMs": round(sum(latency_values) / len(latency_values)) if latency_values else None,
            "withLatency": len(latency_values),
        },
        "dbError": db_error,
    })


@app.route("/api/studio/persona-presets")
def handle_studio_persona_presets():
    _, _, error_response = _require_studio_admin()
    if error_response:
        return error_response
    return json_response({
        "defaultPreset": STUDIO_DEFAULT_VISUAL_PRESET,
        "note": "Type-specific presets are managed through the visual presets content table.",
    })


@app.route("/api/studio/samples")
def handle_studio_samples():
    _, _, error_response = _require_studio_admin()
    if error_response:
        return error_response
    rows, db_error = _collect_studio_samples(300)
    return json_response({"rows": rows, "dbConfigured": is_db_enabled(), "dbError": db_error})


@app.route("/api/studio/content/<resource>", methods=["GET", "POST"])
@app.route("/api/studio/content/<resource>/<row_id>", methods=["GET", "PATCH", "DELETE"])
def handle_studio_content(resource, row_id=""):
    _, _, error_response = _require_studio_admin()
    if error_response:
        return error_response
    specs = _content_specs()
    if resource not in specs:
        return json_response({"error": f"Unknown Studio content resource: {resource}"}, 404)
    spec = specs[resource]
    table = spec["table"]
    if request.method == "GET":
        status, body = get_row(table, row_id) if row_id else list_rows(table, order=spec["order"], limit=500)
        rows = body if isinstance(body, list) else ([] if body is None else [body])
        return json_response({"rows": rows}, status if status >= 300 else 200)
    if request.method == "POST":
        payload = _sanitize_content_payload(resource, request.get_json(silent=True) or {}, partial=False)
        status, body = create_row(table, payload)
        return json_response({"rows": body or []}, status if status >= 300 else 200)
    if request.method == "PATCH":
        if not row_id:
            return json_response({"error": "Row id is required"}, 400)
        payload = _sanitize_content_payload(resource, request.get_json(silent=True) or {}, partial=True)
        status, body = update_row(table, row_id, payload)
        return json_response({"rows": body or []}, status if status >= 300 else 200)
    if request.method == "DELETE":
        if not row_id:
            return json_response({"error": "Row id is required"}, 400)
        status, body = delete_row(table, row_id)
        return json_response({"ok": status < 300, "rows": body or []}, status if status >= 300 else 200)
    return json_response({"error": "Method not allowed"}, 405)


@app.route("/api/score", methods=["POST"])
def handle_score():
    data = request.get_json(force=True)
    answers = data.get("answers", [])
    result = score_traditional(answers)
    result["selected_questions"] = select_open_ended(result["details"])
    return jsonify(result)


@app.route("/api/analyze", methods=["POST"])
def handle_analyze():
    data = request.get_json(force=True)
    try:
        result = analyze_with_ai(
            data.get("type", ""),
            data.get("identity", ""),
            data.get("details", {}),
            data.get("open_answers", []),
        )
    except ValueError as exc:
        return str(exc), 400, {"Content-Type": "text/plain; charset=utf-8"}
    result["analysis_locale"] = "zh-CN"
    return jsonify(result)


# Vercel WSGI entry point
app = app
