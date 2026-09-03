FROM node:24-alpine
WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend-part/package.json frontend-part/package.json
COPY backend-part/package.json backend-part/package.json
COPY database-part/package.json database-part/package.json
COPY shared-part/contracts/package.json shared-part/contracts/package.json
RUN pnpm install --frozen-lockfile

COPY database-part database-part

USER node
CMD ["./database-part/node_modules/.bin/prisma", "migrate", "deploy", "--config", "database-part/prisma.config.ts"]
