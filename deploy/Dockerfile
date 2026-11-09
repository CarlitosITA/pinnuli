# Immagini di Pìnnuli: `web` (Next.js) e `worker` (promemoria, avvisi, migrazioni).
# Si costruisce dalla radice del repository:  docker build -f deploy/Dockerfile --target web .

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
RUN npm ci

FROM deps AS build
COPY . .
# Valori finti: servono solo perché la compilazione non si lamenti, quelli veri arrivano all'avvio.
ENV NEXT_TELEMETRY_DISABLED=1 SESSION_SECRET=solo-per-la-compilazione-solo-per-la-compilazione DATABASE_URL=postgres://build@localhost/build
RUN npm run build

# ── Sito web ─────────────────────────────────────────────
FROM node:22-slim AS web
LABEL org.opencontainers.image.source="https://github.com/CarlitosITA/pinnuli"
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN groupadd --system pinnuli && useradd --system --gid pinnuli --no-create-home pinnuli
COPY --from=build --chown=pinnuli:pinnuli /app/apps/web/.next/standalone ./
COPY --from=build --chown=pinnuli:pinnuli /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=pinnuli:pinnuli /app/apps/web/public ./apps/web/public
USER pinnuli
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ── Worker e strumenti (migrazioni, seed) ────────────────
FROM build AS worker
LABEL org.opencontainers.image.source="https://github.com/CarlitosITA/pinnuli"
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system pinnuli && useradd --system --gid pinnuli --no-create-home pinnuli && chown -R pinnuli:pinnuli /app/apps/web
USER pinnuli
CMD ["npm", "run", "worker"]
