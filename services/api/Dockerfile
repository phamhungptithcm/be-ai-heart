FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV BE_AI_HEART_API_HOST=0.0.0.0

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
COPY scripts ./scripts
COPY heart.config.yaml ./heart.config.yaml

RUN npm ci --omit=dev

EXPOSE 8080

CMD ["npm", "run", "api:start"]
