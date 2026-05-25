This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Local Postgres For OGCode

This repo includes a dedicated local Postgres setup for the OGCode question bank and Origin AI pgvector tables.

1. Copy the env example:

```bash
cp .env.example .env.local
```

2. Start Postgres:

```bash
npm run db:up
```

3. Import the OGCode bank:

```bash
npm run ogcode:import:replace
```

The app reads the catalog from `OGCODE_DATABASE_URL` when it is present. The Docker setup exposes Postgres on `127.0.0.1:54329` and keeps data in the `origin_v1_ogcode_pgdata` Docker volume.

## Origin AI Vector Seed

The Docker image already includes pgvector. `/health` only proves pgvector is available; AI Explainer chapter counts require rows in `origin_ai.concept_embeddings`.

To create the vector rows on a machine with a valid Gemini embedding key:

```bash
npm run db:up
npm run origin-ai:seed-embeddings:replace
npm run origin-ai:vectors:export -- --out data/origin-ai-vector-seed.json.gz
```

Commit `data/origin-ai-vector-seed.json.gz` only if the file size is acceptable for the repo. If it is large, publish it via Git LFS or a release artifact instead.

Teammates can restore the shared vectors after starting Docker:

```bash
npm run db:up
npm run ogcode:import:replace
npm run origin-ai:vectors:import:replace -- --file data/origin-ai-vector-seed.json.gz
```

Restart `origin-ai` after importing so its in-memory chapter map rebuilds from the restored vectors.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
