FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build

COPY tsconfig.json eslint.config.mjs ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine

ARG SERVICE_VERSION=unknown
ARG RESPONSES_VERSION=unknown

LABEL org.opencontainers.image.title="responses-microservice"
LABEL org.opencontainers.image.description="REST API microservice wrapper for @iqb/responses"
LABEL org.opencontainers.image.source="https://github.com/iqb-berlin/responses-microservice"
LABEL org.opencontainers.image.version=$SERVICE_VERSION
LABEL de.iqb.responses.version=$RESPONSES_VERSION

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
