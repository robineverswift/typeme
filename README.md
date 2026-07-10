# TypeMe

TypeMe is a bilingual 16-type personality assessment app. It combines a structured MBTI-style scale with short open-ended prompts, then generates a clearer type profile with supporting evidence, adjacent possibilities, and a more personal interpretation.

Live demo: https://typeme-beta.vercel.app

## Highlights

- 50 scale questions across EI, SN, TF, JP, and AT dimensions
- Dynamic open-ended prompts selected from borderline or high-signal dimensions
- Type landing with confidence, adjacent candidates, and dimension coordinates
- AI-assisted profile synthesis with fallback behavior when AI is unavailable
- Chinese and English UI localization
- Type library for browsing the 16 base types
- Vercel deployment with a small Flask serverless adapter

## How It Works

1. The scale test estimates an initial type and identity variant.
2. The scoring endpoint identifies close dimensions and candidate adjacent types.
3. Five open prompts collect real-life decision, pressure, and relationship context.
4. The analysis endpoint combines scale data and written answers into a Type Profile.

The result is intended as a reflective profile, not a clinical diagnosis.

## Privacy And Data

- Normal answers are stored locally in the browser unless explicitly submitted.
- API keys are read from environment variables and are not committed.
- `mbti/config.json` is ignored and should only be used for local development.
- Vercel production keys should be configured in the Vercel dashboard.

## Studio Status

The deployed Vercel app includes the protected Studio shell:

- `/`
- `/api/questions`
- `/api/score`
- `/api/analyze`
- `/studio`
- `/api/studio/*`
- `/api/samples`

Studio uses Supabase Auth for login and server-side Supabase REST calls for admin data. To enable it on Vercel, configure these environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STUDIO_ADMIN_EMAILS`
- `STUDIO_COOKIE_SECRET` recommended

Run `supabase/schema.sql` in the Supabase SQL editor before using the dashboard, content tables, analysis logs, or anonymous sample storage. The service-role key is used only inside `api/index.py`; never expose it in frontend code.

If the main Studio tables already exist but the dashboard reports `PGRST205` for `persona_response_samples`, run the smaller patch instead:

```sql
-- Supabase SQL editor
-- see supabase/studio_samples_patch.sql
```

After configuring Vercel and Supabase, verify the deployed wiring locally:

```bash
python scripts/check-remote-studio.py
```

## Local Development

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the Vercel Flask adapter locally:

```bash
python api/index.py
```

For the full local development app, use the main workspace version under `D:\Code\1123\mbti`.

## Deployment Notes

This repository is adapted for Vercel:

- `api/index.py` is the Flask serverless entry point.
- `api/templates/index.html` serves the TypeMe app shell.
- `public/index.html` mirrors the app shell for static inspection. Frontend shell changes must update both HTML copies; production `/` reads `api/templates/index.html`.
- `public/typeme-app.css` and `public/typeme-app.js` provide the active UI layer.
- `questions.json` is loaded from the project root by the serverless function.
- `public/studio.html` is served through the `/studio` rewrite.
- `supabase/schema.sql` defines the current Studio/admin tables.

Do not copy the stdlib `BaseHTTPRequestHandler` server from the local workspace into `api/index.py`; the Vercel deployment uses Flask.

## Tech Stack

- Frontend: vanilla JavaScript, CSS, Tailwind CDN
- Backend: Python Flask on Vercel Serverless Functions
- AI: OpenAI-compatible chat completion endpoint, configured via environment variables
- Data: JSON question bank, optional Supabase-backed Studio/admin tables

## License

MIT
