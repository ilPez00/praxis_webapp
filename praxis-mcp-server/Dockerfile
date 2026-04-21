FROM node:18-slim

WORKDIR /app

COPY package.json ./
RUN npm ci --production

COPY dist/ ./dist/

ENV NODE_ENV=production

EXPOSE 3456

CMD ["node", "dist/index.js"]