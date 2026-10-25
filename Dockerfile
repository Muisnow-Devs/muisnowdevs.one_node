FROM node:24-bookworm-slim AS base

WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

FROM base AS dependencies

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --non-interactive

FROM dependencies AS build

ARG VITE_PUBLIC_URL
ENV VITE_PUBLIC_URL=${VITE_PUBLIC_URL}

COPY . .

RUN yarn build

RUN ./node_modules/.bin/esbuild ./app/infrastructure/db/migrate.ts \
    --bundle \
    --platform=node \
    --format=esm \
    --packages=external \
    --outfile=./build/migrate.mjs

FROM base AS production-dependencies

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --non-interactive --production=true && yarn cache clean

FROM node:24-bookworm-slim AS application

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /app

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY public ./public
COPY privacy ./privacy
COPY migrations ./migrations
COPY package.json ./

EXPOSE 3000

USER node

CMD ["./node_modules/.bin/react-router-serve", "./build/server/index.js"]

FROM application AS migration

CMD ["node", "./build/migrate.mjs"]

FROM application AS runtime
