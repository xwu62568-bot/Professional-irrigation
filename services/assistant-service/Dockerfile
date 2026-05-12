FROM node:20-bookworm-slim

WORKDIR /app/assistant-service

COPY assistant-service/package.json ./package.json
RUN npm install --omit=dev

COPY assistant-service/src ./src
COPY shared /app/shared

EXPOSE 4311

CMD ["npm", "run", "start"]
