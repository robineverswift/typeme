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

The deployed Vercel app currently exposes the public test flow only:

- `/`
- `/api/questions`
- `/api/score`
- `/api/analyze`

The internal Studio/admin prototype is not deployed in this repository yet. It requires protected Studio routes, authentication, and Supabase-backed data APIs before `/studio` can be used on Vercel.

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
- `public/typeme-app.css` and `public/typeme-app.js` provide the active UI layer.
- `questions.json` is loaded from the project root by the serverless function.

Do not copy the stdlib `BaseHTTPRequestHandler` server from the local workspace into `api/index.py`; the Vercel deployment uses Flask.

## Tech Stack

- Frontend: vanilla JavaScript, CSS, Tailwind CDN
- Backend: Python Flask on Vercel Serverless Functions
- AI: OpenAI-compatible chat completion endpoint, configured via environment variables
- Data: JSON question bank, optional Supabase-backed Studio planned separately

## License

MIT
