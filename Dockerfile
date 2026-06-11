# syntax=docker/dockerfile:1
# Multi-stage build for Next.js 16 → Azure Container Apps.
# Built remotely via `az acr build` (no local Docker required).
#
# NOTE: we run `next start` against the full .next output rather than
# `output: standalone`, because Next 16's Turbopack build does not reliably
# trace all server chunks into .next/standalone (missing-chunk 500s).

# Docker Hub official image via the ECR Public mirror — pulling docker.io/node
# from ACR build agents intermittently fails with "toomanyrequests"
# (unauthenticated pull rate limit). Same image, no auth, no practical limit.
FROM public.ecr.aws/docker/library/node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# ── All deps (for build) ─────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# The lock is written by npm 11 locally; node:22's bundled npm 10 resolves
# optional deps (esbuild/@emnapi) differently and rejects it. Pin npm 11.
RUN npm install -g npm@11 && npm ci

# ── Build ────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Ship full node_modules: `next start` loads next.config.ts at runtime and
# needs `typescript` to transpile it (a devDependency). Bigger image, but
# avoids runtime auto-install (which fails as non-root).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

USER nextjs
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
