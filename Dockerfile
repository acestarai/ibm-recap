# Use Node.js LTS version
FROM node:18-alpine

# Install ffmpeg for audio processing
RUN apk add --no-cache ffmpeg

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY server ./server
COPY public ./public
COPY scripts ./scripts

# Create output directory
RUN mkdir -p output

# Expose port (Code Engine will use PORT env variable)
EXPOSE 8787

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["node", "server/index.js"]