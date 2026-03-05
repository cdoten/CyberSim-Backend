FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better Docker caching)
COPY package*.json ./
RUN npm ci --only=production
# Copy application code
COPY . .

EXPOSE 8080

CMD ["node", "."]