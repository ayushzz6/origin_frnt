# Build from V1/ root:
#   docker build -f new-frontend/Dockerfile -t origin-frontend .

FROM node:22-slim@sha256:d415caac2f1f77b98caaf9415c5f807e14bc8d7bdea62561ea2fef4fbd08a73c AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY new-frontend/package.json new-frontend/package-lock.json ./
RUN npm ci

FROM deps AS builder
COPY new-frontend/ ./
RUN NEXT_PUBLIC_API_URL=/api NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 npm run build

FROM node:22-slim@sha256:d415caac2f1f77b98caaf9415c5f807e14bc8d7bdea62561ea2fef4fbd08a73c AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN useradd --create-home --shell /usr/sbin/nologin appuser

COPY --from=builder --chown=appuser:appuser /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/.next ./.next
COPY --from=builder --chown=appuser:appuser /app/public ./public

USER appuser

EXPOSE 3000

CMD ["sh", "-c", "exec npm run start -- --hostname 0.0.0.0 --port ${PORT:-3000}"]
