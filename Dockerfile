# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy dependency manifests + patches first (layer caching)
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install all dependencies (including devDeps needed for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Public OAuth identifiers are compiled into the Vite bundle. They are not
# credentials, but must be supplied explicitly when building outside Manus.
ARG VITE_APP_ID
ARG VITE_OAUTH_PORTAL_URL
ARG VITE_RELEASE_SHA
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_APP_ID=$VITE_APP_ID
ENV VITE_OAUTH_PORTAL_URL=$VITE_OAUTH_PORTAL_URL
ENV VITE_RELEASE_SHA=$VITE_RELEASE_SHA
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

# A production image without these public Firebase identifiers can serve the
# app but cannot establish any new operator session. Refuse that broken image
# at build time instead of discovering it after deployment.
RUN test -n "$VITE_FIREBASE_API_KEY" \
  && test -n "$VITE_FIREBASE_AUTH_DOMAIN" \
  && test -n "$VITE_FIREBASE_PROJECT_ID" \
  && test -n "$VITE_FIREBASE_APP_ID"

# Build Vite frontend + bundle Express server
RUN pnpm build

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:22-alpine AS runner

# Install pnpm for production install
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package manifests + patches
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# Cloud Run injects PORT env var; default to 8080
ENV PORT=8080
ENV NODE_ENV=production

# Expose the port (documentation only — Cloud Run uses PORT env)
EXPOSE 8080

# Run the bundled Express server
CMD ["node", "dist/index.js"]
