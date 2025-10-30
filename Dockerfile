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
RUN npm install --production --build-from-source
COPY . .
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node","index.js"]
