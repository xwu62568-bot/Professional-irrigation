FROM node:20-bookworm-slim

WORKDIR /app/execution-service

COPY execution-service/package.json ./package.json
RUN npm install --omit=dev

COPY execution-service/src ./src
COPY shared /app/shared

EXPOSE 4310

CMD ["npm", "run", "start"]
