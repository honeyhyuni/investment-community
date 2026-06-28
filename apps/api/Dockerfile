FROM node:24-alpine AS deps

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci --workspace api --include-workspace-root

FROM node:24-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace api

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN addgroup -S nestjs && adduser -S nestjs -G nestjs

COPY --from=builder --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nestjs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nestjs /app/apps/api/src/markets/data ./dist/markets/data
COPY --from=builder --chown=nestjs:nestjs /app/apps/api/package*.json ./

USER nestjs

EXPOSE 4000

CMD ["node", "dist/main.js"]
