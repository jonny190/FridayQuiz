FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install pnpm v9 globally
RUN npm install -g pnpm@9.15.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install pnpm v9 globally for build stage
RUN npm install -g pnpm@9.15.0

# Generate Prisma client (skip db push - no database at build time)
RUN npx prisma generate && \
    pnpm build

# Production image, copy all files and run Next.js
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install pnpm v9 globally for runtime
RUN npm install -g pnpm@9.15.0

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Set proper permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Apply schema to the database, then start Next.js
CMD ["sh", "-c", "npx prisma db push --skip-generate && pnpm start"]