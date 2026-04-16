FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3005

ENV NODE_OPTIONS="--max-old-space-size=1024"
CMD ["npm", "start"]
