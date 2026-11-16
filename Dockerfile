FROM node:22-alpine AS build
WORKDIR /app
# NEXT_PUBLIC_* is inlined into the client bundle here, at build time. The
# build context excludes .env* (see .dockerignore), so these must arrive as
# build args or the browser bundle ships with undefined Supabase settings.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_SENTRY_DSN
# AdSense identifiers are read at build time too: the slot component compares
# them client-side. Empty by default, so a build without them is ad-inert.
ARG NEXT_PUBLIC_ADSENSE_CLIENT=""
ARG NEXT_PUBLIC_ADSENSE_SLOT_HERB=""
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_ADSENSE_CLIENT=$NEXT_PUBLIC_ADSENSE_CLIENT \
    NEXT_PUBLIC_ADSENSE_SLOT_HERB=$NEXT_PUBLIC_ADSENSE_SLOT_HERB
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN node scripts/patch-next-image-optimizer.mjs
ENV NEXT_TELEMETRY_DISABLED=1
# Cap the V8 heap so a runaway build dies inside Node instead of growing until
# the kernel OOM-kills a live Postgres beside it (~2–3 GB peak is expected).
ENV NODE_OPTIONS=--max-old-space-size=3072
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
RUN mkdir -p /app/.next/cache/images /app/.next/cache/fetch-cache && chown -R nextjs:nodejs /app/.next
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"
CMD ["node", "server.js"]
