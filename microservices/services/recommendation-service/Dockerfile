FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
# Copy prisma directory for schema
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm install

# Generate Prisma Client during build
RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3004

CMD ["sh", "-c", "npm start"]
