import hashlib
import json
import threading
import time
from collections import OrderedDict, defaultdict, deque
from copy import deepcopy


SCORE_MAX_BODY_BYTES = 32_000
ANALYZE_MAX_BODY_BYTES = 80_000
ANALYZE_CACHE_TTL_SECONDS = 120
ANALYZE_CACHE_MAX_ENTRIES = 16
ANALYZE_RATE_LIMIT_REQUESTS = 12
ANALYZE_RATE_LIMIT_WINDOW_SECONDS = 600


class RequestProblem(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def normalize_locale(value):
    return "en" if str(value or "").strip().lower().startswith("en") else "zh-CN"


def _require_object(payload):
    if not isinstance(payload, dict):
        raise RequestProblem("Request body must be a JSON object")
    return payload


def validate_score_payload(payload):
    payload = _require_object(payload)
    answers = payload.get("answers")
    if not isinstance(answers, list):
        raise RequestProblem("answers must be an array")
    if len(answers) > 100:
        raise RequestProblem("Too many answers", 413)
    for answer in answers:
        if not isinstance(answer, dict) or "id" not in answer or "value" not in answer:
            raise RequestProblem("Each answer must include id and value")
        try:
            int(answer["id"])
            float(answer["value"])
        except (TypeError, ValueError):
            raise RequestProblem("Answer id and value must be numeric")
    return payload


def validate_analyze_payload(payload):
    payload = dict(_require_object(payload))
    type_code = str(payload.get("type") or "").strip().upper()
    identity = str(payload.get("identity") or "").strip().upper()
    if len(type_code) != 4 or any(
        letter not in allowed
        for letter, allowed in zip(type_code, ("IE", "SN", "TF", "JP"))
    ):
        raise RequestProblem("Invalid personality type")
    if identity not in {"A", "T"}:
        raise RequestProblem("Invalid identity type")
    if not isinstance(payload.get("details"), dict):
        raise RequestProblem("details must be an object")
    open_answers = payload.get("open_answers")
    if not isinstance(open_answers, list):
        raise RequestProblem("open_answers must be an array")
    if len(open_answers) > 5:
        raise RequestProblem("Too many open answers", 413)
    total_characters = 0
    for item in open_answers:
        if not isinstance(item, dict):
            raise RequestProblem("Each open answer must be an object")
        answer = str(item.get("answer") or "")
        if len(answer) > 6_000:
            raise RequestProblem("An open answer is too long", 413)
        total_characters += len(answer)
    if total_characters > 20_000:
        raise RequestProblem("Open answers are too long", 413)
    confidence = payload.get("confidence")
    if confidence is not None and not isinstance(confidence, dict):
        raise RequestProblem("confidence must be an object")
    candidates = payload.get("candidate_types")
    if candidates is not None and (not isinstance(candidates, list) or len(candidates) > 8):
        raise RequestProblem("candidate_types must be an array with at most 8 items")
    payload["type"] = type_code
    payload["identity"] = identity
    payload["locale"] = normalize_locale(payload.get("locale"))
    return payload


def request_fingerprint(payload):
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class TTLResultCache:
    def __init__(self, ttl_seconds=ANALYZE_CACHE_TTL_SECONDS, max_entries=ANALYZE_CACHE_MAX_ENTRIES):
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._items = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key, now=None):
        now = time.monotonic() if now is None else now
        with self._lock:
            item = self._items.get(key)
            if not item:
                return None
            created_at, value = item
            if now - created_at > self.ttl_seconds:
                self._items.pop(key, None)
                return None
            self._items.move_to_end(key)
            return deepcopy(value)

    def put(self, key, value, now=None):
        now = time.monotonic() if now is None else now
        with self._lock:
            self._items[key] = (now, deepcopy(value))
            self._items.move_to_end(key)
            while len(self._items) > self.max_entries:
                self._items.popitem(last=False)


class SlidingWindowLimiter:
    def __init__(self, limit=ANALYZE_RATE_LIMIT_REQUESTS, window_seconds=ANALYZE_RATE_LIMIT_WINDOW_SECONDS):
        self.limit = limit
        self.window_seconds = window_seconds
        self._events = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, client_key, now=None):
        now = time.monotonic() if now is None else now
        cutoff = now - self.window_seconds
        with self._lock:
            events = self._events[client_key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= self.limit:
                return False
            events.append(now)
            return True
