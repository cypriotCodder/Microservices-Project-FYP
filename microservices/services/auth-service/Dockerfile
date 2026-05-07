FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm install

# Generate Prisma Client
RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3001

ENV NODE_OPTIONS="--max-old-space-size=512"
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/seed.js && npm start"]
