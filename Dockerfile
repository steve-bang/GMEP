# GMEP production image (H4). Multi-stage, Next.js standalone output, non-root, health check.
# Build:  docker build -t gmep:local .
# Run:    docker run --rm -p 8080:8080 --env-file .env.local gmep:local   (needs emulators/GCP env, see README)
# No secrets are baked into the image: configuration comes from environment variables at run time.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc* ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_OUTPUT=standalone NODE_ENV=production
RUN pnpm build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
WORKDIR /app
# non-root user (Cloud Run runs any uid, but never as root by policy)
RUN groupadd --system --gid 1001 gmep && useradd --system --uid 1001 --gid gmep --no-create-home gmep
COPY --from=build --chown=gmep:gmep /app/.next/standalone ./
COPY --from=build --chown=gmep:gmep /app/.next/static ./.next/static
COPY --from=build --chown=gmep:gmep /app/public ./public
USER gmep
EXPOSE 8080
# Liveness only (no dependency check): readiness is `/api/health?ready=1`
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
