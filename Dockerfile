FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js .
COPY --from=builder /app/dist ./dist
USER appuser
EXPOSE 3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production
CMD ["node", "server.js"]
