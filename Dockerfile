# syntax=docker/dockerfile:1

# ── Stage 1: dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps
# Prisma's query engine is glibc-linked; on Alpine it needs these shims.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
# `npm ci` runs prisma's postinstall, which generates the client into node_modules.
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# This project keeps its assets under src/app and has no public/ directory.
# Creating it unconditionally keeps the runtime COPY below valid either way.
RUN mkdir -p public

# The build only needs a syntactically valid URL: Prisma reads the real one at
# runtime, and no page queries the database while building.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate && npm run build

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user; the image should never need to write outside /app.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The standalone tracer does not reliably pick up Prisma's generated client and
# engine binaries, so they are copied explicitly. The schema comes along too, so
# `prisma db push` can be run from inside the container when the schema changes.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
