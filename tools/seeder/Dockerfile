FROM node:20-slim

# Prisma 5.x native engine needs OpenSSL — slim image includes it
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm install

# Generate Prisma Client
RUN npx prisma generate

COPY . .

RUN npx tsc

CMD ["node", "dist/seed.js"]
