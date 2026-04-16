FROM node:24.14.0-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10.33.0

COPY pnpm-lock.yaml .
RUN pnpm fetch

COPY . .
RUN pnpm install --offline
RUN pnpm build

FROM node:24.14.0-alpine

WORKDIR /app

RUN npm install -g pnpm@10.33.0

COPY pnpm-lock.yaml .
RUN pnpm fetch

COPY package.json .
RUN pnpm install --offline --prod

COPY --from=builder /app/dist ./dist

EXPOSE 80
CMD ["pnpm", "serve"]
