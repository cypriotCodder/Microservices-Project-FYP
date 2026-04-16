FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3003
ENV NODE_OPTIONS="--max-old-space-size=512"
CMD ["npm", "start"]
