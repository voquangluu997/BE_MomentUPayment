# ============================================
# Stage 1: Build - Biên dịch ứng dụng
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json và package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm ci --only=development

# Copy source code
COPY . .

# Prisma - Generate client và build application
RUN npm run prisma:validate && \
    npm run build

# ============================================
# Stage 2: Runtime - Chạy ứng dụng
# ============================================
FROM node:20-alpine

WORKDIR /app

# 🔒 Tạo non-root user cho security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy node_modules từ builder
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy Prisma schema và migrations
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# Copy dist folder từ builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copy package.json để biết version
COPY --chown=nestjs:nodejs package.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8001) + '/health', (res) => {if (res.statusCode !== 200) throw new Error(res.statusCode)})"

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 8001

# Start application
CMD ["npm", "run", "start:prod"]
