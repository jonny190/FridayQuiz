FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Check for pnpm-workspace.yaml to include it
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && \
    if [ -f pnpm-workspace.yaml ]; then \
      pnpm install --frozen-lockfile; \
    else \
      pnpm install --frozen-lockfile; \
    fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client and push schema
RUN npx prisma generate && \
    # Skip db push in build (no database available) - handled at runtime
    pnpm build

# Production image, copy all files and run Next.js
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/.prisma ./.prisma

# Set proper permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["pnpm", "start"]