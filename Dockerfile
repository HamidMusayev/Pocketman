FROM node:20-alpine

WORKDIR /app

# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app sources
COPY server.js index.html ./

# Persist DB outside the image
ENV DB_PATH=/data/finance.db
VOLUME ["/data"]

EXPOSE 3000

CMD ["node", "server.js"]
