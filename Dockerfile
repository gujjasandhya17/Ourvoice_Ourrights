FROM node:18-bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    python3-dev \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
# Install production dependencies and build native modules from source when needed
# Use npm ci for reproducible install when package-lock.json is present
RUN if [ -f package-lock.json ]; then npm ci --production --build-from-source; else npm install --production --build-from-source; fi
COPY . .
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node","index.js"]
