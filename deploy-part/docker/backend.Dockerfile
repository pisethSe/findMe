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
COPY backend-part backend-part
COPY database-part database-part
RUN pnpm --filter @findme/backend build

FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /workspace
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /workspace/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /workspace/backend-part/node_modules ./backend-part/node_modules
COPY --from=builder --chown=nestjs:nodejs /workspace/backend-part/package.json ./backend-part/package.json
COPY --from=builder --chown=nestjs:nodejs /workspace/backend-part/dist ./backend-part/dist
USER nestjs
EXPOSE 3001
CMD ["node", "backend-part/dist/main.js"]
