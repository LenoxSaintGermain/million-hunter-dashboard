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
