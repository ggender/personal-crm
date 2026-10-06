# syntax=docker/dockerfile:1

# Production image of the app. Built by CI (.github/workflows/deploy.yml) and pushed to GHCR.
# The same image runs the Next.js server (default command) and the one-off migration
# container (`node scripts/migrate.ts`, see deploy/compose.yaml).

FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies change rarely, so they get their own cached layer.
FROM base AS deps
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

FROM deps AS build
COPY . .
RUN mkdir -p public && pnpm build
# The migration runner needs only drizzle-orm and postgres. pnpm links packages from its store,
# so copy their real folders; package.json marks scripts/*.ts as ES modules for plain Node.
RUN mkdir -p /migrator/node_modules \
    && cp -RL node_modules/drizzle-orm node_modules/postgres /migrator/node_modules/ \
    && echo '{ "type": "module" }' > /migrator/package.json

FROM base AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /migrator/ ./scripts/
COPY --from=build /app/scripts/migrate.ts ./scripts/migrate.ts
USER node
EXPOSE 3000
# Commit SHA of this build, reported by /health. Last, so a new commit rebuilds only this layer.
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
CMD ["node", "server.js"]
