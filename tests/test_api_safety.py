import importlib.util
import os
import sys
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "api" / "index.py"


def load_api():
    os.environ.setdefault("AI_API_KEY", "test-key")
    name = f"typeme_public_api_safety_{uuid.uuid4().hex}"
    spec = importlib.util.spec_from_file_location(name, MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def analysis_payload(locale="en-US"):
    return {
        "type": "INTJ",
        "identity": "A",
        "details": {},
        "open_answers": [
            {"answer": "When plans changed, I checked what mattered before choosing a smaller scope."},
            {"answer": "During conflict, I asked what happened and then explained my boundary."},
        ],
        "locale": locale,
    }


class PublicApiSafetyTests(unittest.TestCase):
    def test_analyze_forwards_normalized_english_locale(self):
        api = load_api()
        result = {"ai_available": True, "analysis_locale": "en"}
        with patch.object(api, "analyze_with_ai", return_value=result) as analyze:
            response = api.app.test_client().post("/api/analyze", json=analysis_payload())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(analyze.call_args.args[-1], "en")
        self.assertEqual(response.get_json()["analysis_locale"], "en")

    def test_analyze_rejects_oversized_body_before_model_call(self):
        api = load_api()
        response = api.app.test_client().post(
            "/api/analyze",
            data=b"x" * (api.ANALYZE_MAX_BODY_BYTES + 1),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 413)

    def test_successful_duplicate_analysis_uses_short_cache(self):
        api = load_api()
        result = {"ai_available": True, "analysis_locale": "en", "final_type": "INTJ-A"}
        with patch.object(api, "analyze_with_ai", return_value=result) as analyze:
            first = api.app.test_client().post("/api/analyze", json=analysis_payload())
            second = api.app.test_client().post("/api/analyze", json=analysis_payload())
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(analyze.call_count, 1)
        self.assertEqual(second.headers.get("X-TypeMe-Cache"), "HIT")

    def test_english_fallback_is_labeled_english(self):
        api = load_api()
        result = api._fallback_analysis("INTJ", "A", {}, [], "en")
        self.assertEqual(result["analysis_locale"], "en")
        self.assertNotIn("深度分析", result["insight"])

    def test_english_analysis_builds_english_model_prompts(self):
        api = load_api()
        details = {
            dim: {"dominant": pole, "other": other, "dom_pct": 70}
            for dim, pole, other in (
                ("EI", "I", "E"),
                ("SN", "N", "S"),
                ("TF", "T", "F"),
                ("JP", "J", "P"),
                ("AT", "A", "T"),
            )
        }
        first = {
            "analysis_summary": "Your answers show a preference for deliberate structure.",
            "dimension_analysis": {
                dim: {"倾向": data["dominant"], "evidence": "A concrete choice.", "分析": "English analysis."}
                for dim, data in details.items()
            },
            "verdicts": {dim: "confirmed" for dim in details},
            "ai_type": "INTJ-A",
            "final_type": "INTJ-A",
            "answer_quality_score": 80,
        }
        second = "[[PORTRAIT]]\nA calm, deliberate presence with a precise inner compass.\n[[LETTER]]\nYou can move before every uncertainty is resolved."
        with patch.object(api, "call_ai", side_effect=[api.json.dumps(first), second]) as call_ai:
            result = api._analyze_with_deepseek(
                "INTJ",
                "A",
                details,
                analysis_payload()["open_answers"],
                locale="en",
            )
        self.assertEqual(result["analysis_locale"], "en")
        self.assertEqual(call_ai.call_count, 2)
        self.assertTrue(all("English" in call.args[0] for call in call_ai.call_args_list))

    def test_rate_limit_rejects_before_model_call(self):
        api = load_api()
        with (
            patch.object(api._ANALYSIS_LIMITER, "allow", return_value=False),
            patch.object(api, "analyze_with_ai") as analyze,
        ):
            response = api.app.test_client().post("/api/analyze", json=analysis_payload())
        self.assertEqual(response.status_code, 429)
        analyze.assert_not_called()


if __name__ == "__main__":
    unittest.main()
