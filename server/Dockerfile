FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ws/ ./src/ws/

EXPOSE 3001

CMD ["node", "src/ws/index.js"]
