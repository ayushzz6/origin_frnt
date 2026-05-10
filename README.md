# Origin Frontend

Standalone Vercel deployment repo for the `new-frontend` Next.js app.

## Vercel Settings

- Framework preset: `Next.js`
- Root directory: repository root
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: leave empty / Vercel default
- Node runtime: Vercel default Node 22 or newer

## Required Production Environment

Add these in Vercel Project Settings -> Environment Variables for Production, Preview, and Development as needed:

```txt
ORIGIN_DEPLOYMENT_ENV=production
USER_DATABASE_URL
OGCODE_DATABASE_URL
GRADER_SERVICE_URL
GRADER_SERVICE_TOKEN
ANALYTICS_SERVICE_URL
ANALYTICS_SERVICE_TOKEN
ORIGIN_AI_SERVICE_URL
ORIGIN_AI_SERVICE_TOKEN
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
AUTH_JWT_SECRET_CURRENT
AUTH_JWT_SECRET_PREVIOUS
ROOM_CODE_SECRET
OPTION_SHUFFLE_SECRET
INTERNAL_CRON_TOKEN
NEXT_PUBLIC_SITE_URL=https://<your-vercel-domain>
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID
NEXT_PUBLIC_ORIGIN_AI_URL
NEXT_PUBLIC_R2_PUBLIC_HOSTNAME
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
EMAIL_FROM
```

Optional runtime tuning variables:

```txt
GRADER_SERVICE_TIMEOUT_MS
ANALYTICS_SERVICE_TIMEOUT_MS
ORIGIN_AI_PROVIDER_TIMEOUT_MS
METRICS_OTLP_HTTP_ENDPOINT
METRICS_OTLP_HTTP_TOKEN
GEMINI_MODEL
GEMINI_STT_MODEL
GEMINI_TTS_MODEL
GEMINI_LIVE_MODEL
GEMINI_LIVE_VOICE_NAME
```

Do not commit real `.env` files. `.env.example` contains placeholders only.

## Local Verification

```bash
npm ci
npm run typecheck
npm run test:unit
npm run lint
npm run build
```

`npm run lint` currently passes with existing warnings.
