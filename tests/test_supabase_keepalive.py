import importlib.util
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "api" / "index.py"


def load_api(cron_secret="test-cron-secret-1234"):
    os.environ["CRON_SECRET"] = cron_secret
    os.environ["SUPABASE_URL"] = "https://example.supabase.co"
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role"
    spec = importlib.util.spec_from_file_location("typeme_public_api_test", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class SupabaseKeepaliveTests(unittest.TestCase):
    def test_rejects_request_without_matching_secret(self):
        api = load_api()
        response = api.app.test_client().get("/api/cron/supabase-keepalive")
        self.assertEqual(response.status_code, 401)

    def test_requires_configured_secret(self):
        api = load_api("")
        response = api.app.test_client().get("/api/cron/supabase-keepalive")
        self.assertEqual(response.status_code, 503)

    def test_runs_three_read_only_database_probes(self):
        api = load_api()
        with patch.object(api, "db_request", return_value=(200, [])) as db_request:
            response = api.app.test_client().get(
                "/api/cron/supabase-keepalive",
                headers={"Authorization": "Bearer test-cron-secret-1234"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["ok"])
        self.assertEqual(db_request.call_count, 3)
        self.assertTrue(all(call.args[0].endswith("select=id&limit=1") for call in db_request.call_args_list))


if __name__ == "__main__":
    unittest.main()
