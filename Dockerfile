# Build stage: checks the pages and writes them to dist/ (fails on invalid HTML, naming file and line).
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY .htmlvalidate.json ./
COPY scripts ./scripts
COPY public ./public
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
ENV PAGES_DIR=dist
EXPOSE 3000
USER node
CMD ["node", "src/server.js"]
