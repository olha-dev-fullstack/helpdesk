FROM oven/bun:1.4 AS app
WORKDIR /app

# Install dependencies first so the layers cache until a lockfile changes
COPY core/package.json core/bun.lock core/
COPY server/package.json server/bun.lock server/
COPY client/package.json client/bun.lock client/
RUN cd core && bun install --frozen-lockfile \
 && cd ../server && bun install --frozen-lockfile \
 && cd ../client && bun install --frozen-lockfile

COPY core core
COPY server server
COPY client client

# prisma.config.ts needs DATABASE_URL to be set even though generate never connects
RUN cd server && DATABASE_URL=postgresql://build:build@localhost:5432/build bun run db:generate
# Railway passes service variables with a matching ARG into the build
ARG VITE_SENTRY_DSN
RUN cd client && bun run build

ENV NODE_ENV=production
WORKDIR /app/server
EXPOSE 3000
CMD ["bun", "src/index.ts"]
