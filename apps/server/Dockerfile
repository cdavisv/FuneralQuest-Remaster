# syntax=docker/dockerfile:1
#
# Funeral Quest: the game server and the web client, on one port. Build from the repository root:
#   docker build -f apps/server/Dockerfile -t funeral-quest .
# or run `docker compose up` (root docker-compose.yml, or apps/server/docker-compose.yml).
#
# Build argument INCLUDE_MUSEUM=1 adds "museum mode" (the original 2001 Flash client under Ruffle,
# switched on at run time with FQ_LEGACY_CLIENT=1). It copies the original client's files, which
# include its sounds, into the image; those sounds are licensed only for Funeral Quest (see the
# README's licence notes), so the default image leaves them out.

#
# Build argument FQ_BUILD (default "dev") is the build id the server reports on /health and the
# client shows in Settings (the short commit). .git is not in the build context, so pass it in:
#   docker build -f apps/server/Dockerfile --build-arg FQ_BUILD=$(git rev-parse --short=7 HEAD) -t funeral-quest .
#   FQ_BUILD=$(git rev-parse --short=7 HEAD) docker compose build

ARG INCLUDE_MUSEUM=0

# ---- build: install the workspace, build the web client, bundle the server --------------
FROM node:24-slim AS build
ARG FQ_BUILD=dev
RUN npm install --global pnpm@12.18.0
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/content/package.json packages/content/package.json
COPY packages/legacy-compat/package.json packages/legacy-compat/package.json
COPY packages/bots/package.json packages/bots/package.json
COPY packages/solo/package.json packages/solo/package.json
COPY packages/audio/package.json packages/audio/package.json
# The build scripts pnpm may run (esbuild) are listed in allowBuilds in pnpm-workspace.yaml.
RUN pnpm install --frozen-lockfile --filter "@fq/server..." --filter "@fq/client..."
COPY packages/protocol packages/protocol
COPY packages/core packages/core
COPY packages/content packages/content
COPY packages/legacy-compat packages/legacy-compat
# Solo mode (the client bundles it, with the AI rivals, into a Web Worker).
COPY packages/bots packages/bots
COPY packages/solo packages/solo
# The audio package (the Synth synthesiser, the cue map, the pack manifests the client reads).
COPY packages/audio packages/audio
# The client's build reads the exported Classic art (assets/classic: the UI sprite sheets it
# derives pieces from, and the single-frame pictures it bundles) and the credits page's text.
COPY assets/classic assets/classic
# The sound: the Synth pack (assets/audio), the Studio and "Original, remastered" packs and the
# character voices. The client's build bundles whichever of them have a manifest.json.
COPY assets/audio assets/audio
COPY assets/audio-studio assets/audio-studio
COPY assets/audio-remaster assets/audio-remaster
COPY assets/voice assets/voice
COPY CREDITS.md ./
COPY apps/server apps/server
COPY apps/client apps/client
# FQ_BUILD (the ARG above) is read by the client's vite config and the server's build.mjs.
RUN pnpm --filter @fq/client run build \
 && pnpm --filter @fq/server run typecheck \
 && pnpm --filter @fq/server run build

# ---- museum files: empty unless INCLUDE_MUSEUM=1 ----------------------------------------
FROM build AS museum-0
RUN mkdir -p /museum

FROM build AS museum-1
# Ruffle is a pnpm symlink in the workspace; copy what it points at.
COPY legacy/dist/public /museum/public
COPY assets/manifest.json /museum/manifest.json
RUN cp -rL packages/legacy-compat/node_modules/@ruffle-rs/ruffle /museum/ruffle

FROM museum-${INCLUDE_MUSEUM} AS museum

# ---- runtime: the bundle, the client and the server's npm dependencies ------------------
FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    FQ_HOST=0.0.0.0 \
    FQ_PORT=8080 \
    FQ_DB_PATH=/data/fq.sqlite \
    FQ_CLIENT_DIR=/app/client \
    FQ_MUSEUM_DIR=/museum \
    NODE_OPTIONS="--enable-source-maps --disable-warning=ExperimentalWarning"
WORKDIR /app
COPY --from=build /repo/apps/server/dist/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /repo/apps/server/dist/server.mjs /repo/apps/server/dist/server.mjs.map ./
COPY --from=build /repo/apps/client/dist-build ./client
COPY --from=museum /museum /museum
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.FQ_PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
