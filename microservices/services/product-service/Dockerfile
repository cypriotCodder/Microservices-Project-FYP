FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3002
ENV NODE_OPTIONS="--max-old-space-size=1024"
CMD ["sh", "-c", "node dist/seedStartup.js && npm start"]
