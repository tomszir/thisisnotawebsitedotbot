ARG DOCKER_ENVIRONMENT=production

FROM node:20-alpine AS base

# Enable buildkit
ENV DOCKER_BUILDKIT=1

# Set pnpm environment variables and enable corepack
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Copy the local package files to the container's workspace.
COPY *.json *.yaml /app/
COPY ./src /app/src
COPY ./assets/ /app/assets
WORKDIR /app

# Production dependencies
FROM base AS production-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# Development dependencies
FROM base AS development-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM ${DOCKER_ENVIRONMENT}-deps AS deps
# This is a dummy stage to allow the build to be run with the correct target

# Build environment
FROM base AS build
RUN id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

# Production environment
FROM base AS production
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist

ENTRYPOINT [ "pnpm", "prod" ]

# Development environment
FROM base AS development
COPY --from=deps /app/node_modules /app/node_modules

EXPOSE 9229
CMD [ "pnpm", "dev" ]

FROM ${DOCKER_ENVIRONMENT} AS final
# This is a dummy stage to allow the build to be run with the correct target
