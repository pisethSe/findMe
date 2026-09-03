FROM node:24-alpine AS dependencies
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend-part/package.json frontend-part/package.json
COPY backend-part/package.json backend-part/package.json
COPY database-part/package.json database-part/package.json
COPY shared-part/contracts/package.json shared-part/contracts/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
COPY frontend-part frontend-part
COPY shared-part shared-part
RUN pnpm --filter @findme/frontend build

FROM node:24-alpine AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /workspace
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend-part/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend-part/.next/static ./frontend-part/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "frontend-part/server.js"]
