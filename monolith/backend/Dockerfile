FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 4000
# Cap V8 heap at 1 GB so the process GCs aggressively rather than
# accumulating Groq API response bodies until the OOM killer fires.
ENV NODE_OPTIONS="--max-old-space-size=1024"
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/seed.js && npm start"]
