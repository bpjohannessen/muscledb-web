# muscledb-web container.
# The prebuilt db/muscles.db is copied in as-is; no SQLite CLI needed at build time.
FROM node:22-slim

WORKDIR /app

# Install production deps first for better layer caching.
# better-sqlite3 ships prebuilt linux binaries, so this needs no compiler.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund || true

COPY . .

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5000

EXPOSE 5000
CMD ["node", "server.js"]
