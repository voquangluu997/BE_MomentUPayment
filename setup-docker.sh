#!/bin/bash

# ============================================
# Moment U Payment - Docker Setup Script
# ============================================
# Usage: bash setup-docker.sh [environment]
# Examples:
#   bash setup-docker.sh dev          # Local development
#   bash setup-docker.sh prod         # Production on VPS
#   bash setup-docker.sh render       # Render.com deployment
# ============================================

set -e

ENVIRONMENT=${1:-dev}
BACKEND_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
COLORS_RESET='\033[0m'
COLORS_GREEN='\033[0;32m'
COLORS_YELLOW='\033[1;33m'
COLORS_RED='\033[0;31m'
COLORS_BLUE='\033[0;34m'

# Helper functions
print_header() {
    echo -e "${COLORS_BLUE}========================================${COLORS_RESET}"
    echo -e "${COLORS_BLUE}$1${COLORS_RESET}"
    echo -e "${COLORS_BLUE}========================================${COLORS_RESET}"
}

print_success() {
    echo -e "${COLORS_GREEN}✓ $1${COLORS_RESET}"
}

print_warning() {
    echo -e "${COLORS_YELLOW}⚠ $1${COLORS_RESET}"
}

print_error() {
    echo -e "${COLORS_RED}✗ $1${COLORS_RESET}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    print_success "Docker is installed ($(docker --version))"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    print_success "Docker Compose is installed ($(docker-compose --version))"
    
    # Check Git
    if ! command -v git &> /dev/null; then
        print_warning "Git is not installed (optional)"
    else
        print_success "Git is installed"
    fi
}

# Setup development environment
setup_dev() {
    print_header "Setting up Development Environment"
    
    # Create .env if not exists
    if [ ! -f "$BACKEND_DIR/.env" ]; then
        print_warning "Creating .env from .env.example"
        cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
        print_warning "Please edit .env with your settings"
    else
        print_success ".env already exists"
    fi
    
    # Create docker-compose override for development
    if [ ! -f "$BACKEND_DIR/docker-compose.override.yml" ]; then
        cat > "$BACKEND_DIR/docker-compose.override.yml" << 'EOF'
version: '3.9'
services:
  backend:
    environment:
      NODE_ENV: development
    volumes:
      - ./src:/app/src
      - ./test:/app/test
    command: npm run start:dev
EOF
        print_success "Created docker-compose.override.yml for development"
    fi
    
    # Start services
    print_warning "Starting services..."
    cd "$BACKEND_DIR"
    docker-compose up -d --build
    
    print_success "Services started successfully"
    
    # Wait for services to be ready
    print_warning "Waiting for services to be ready..."
    sleep 10
    
    # Run migrations
    print_warning "Running database migrations..."
    docker-compose exec -T backend npm run migrate:deploy || true
    
    print_header "✓ Development Environment Ready"
    echo ""
    echo "Services:"
    echo "  Backend API: http://localhost:8001"
    echo "  Swagger Docs: http://localhost:8001/api"
    echo "  PostgreSQL: localhost:5432"
    echo "  Redis: localhost:6379"
    echo ""
    echo "Useful commands:"
    echo "  docker-compose logs -f backend      # View logs"
    echo "  docker-compose down                  # Stop services"
    echo "  docker-compose exec backend npm run prisma:studio  # Open Prisma Studio"
}

# Setup production environment on VPS
setup_prod_vps() {
    print_header "Setting up Production on VPS"
    
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root for VPS setup"
        exit 1
    fi
    
    # Update system
    print_warning "Updating system packages..."
    apt update && apt upgrade -y
    
    # Install Docker if not exists
    if ! command -v docker &> /dev/null; then
        print_warning "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
    fi
    
    # Enable Docker service
    systemctl enable docker
    systemctl start docker
    
    # Create .env for production
    if [ ! -f "$BACKEND_DIR/.env" ]; then
        cat > "$BACKEND_DIR/.env" << 'EOF'
# Update these values!
DATABASE_URL="postgresql://user:password@host:5432/db"
DIRECT_URL="postgresql://user:password@host:5432/db"
JWT_SECRET="change_this_to_strong_random_value"
REDIS_HOST="redis.example.com"
REDIS_PORT=6379
REDIS_PASSWORD="change_this_password"
NODE_ENV=production
PORT=8001
CLOUDINARY_CLOUD_NAME=your_value
CLOUDINARY_API_KEY=your_value
CLOUDINARY_API_SECRET=your_value
MAIL_HOST=smtp.resend.com
MAIL_PORT=465
MAIL_USER=resend
MAIL_PASS=your_value
GOOGLE_CLIENT_ID=your_value
GOOGLE_CLIENT_SECRET=your_value
GOOGLE_MAIL_PASS=your_value
ADMIN_SECRET_KEY=your_value
API_BASE_URL=https://yourdomain.com
EOF
        print_warning "Created .env file - PLEASE EDIT WITH YOUR PRODUCTION VALUES"
        print_error "Edit .env now before continuing"
        exit 1
    fi
    
    # Create SSL directory
    mkdir -p "$BACKEND_DIR/ssl"
    mkdir -p "$BACKEND_DIR/www/certbot"
    
    # Start services
    print_warning "Starting production stack..."
    cd "$BACKEND_DIR"
    docker-compose -f docker-compose.full-stack.yml build
    docker-compose -f docker-compose.full-stack.yml up -d
    
    # Run migrations
    print_warning "Running database migrations..."
    sleep 10
    docker-compose -f docker-compose.full-stack.yml exec -T backend npm run migrate:deploy
    
    # Setup SSL
    print_warning "Setting up SSL certificate..."
    print_warning "Run this command manually:"
    echo ""
    echo "docker-compose -f docker-compose.full-stack.yml --profile ssl run --rm certbot certonly --webroot --webroot-path /var/www/certbot -d yourdomain.com --email admin@yourdomain.com --agree-tos --no-eff-email"
    echo ""
    
    # Setup backup cron
    cat > /etc/cron.d/moment-u-backup << 'EOF'
0 2 * * * root cd /path/to/backend && docker-compose exec -T postgres pg_dump -U postgres moment_db | gzip > /backups/db_$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz
EOF
    
    print_header "✓ Production VPS Setup Complete"
    echo ""
    echo "Important next steps:"
    echo "1. Edit .env with your production values"
    echo "2. Setup SSL certificate (see command above)"
    echo "3. Configure firewall:"
    echo "   ufw allow 22"
    echo "   ufw allow 80"
    echo "   ufw allow 443"
    echo "   ufw enable"
}

# Setup for Render.com
setup_render() {
    print_header "Setting up for Render.com"
    
    print_warning "Render.com will automatically detect Dockerfile"
    print_warning "Make sure these are set in Render Dashboard:"
    echo ""
    echo "Environment Variables:"
    echo "  - DATABASE_URL"
    echo "  - DIRECT_URL"
    echo "  - JWT_SECRET"
    echo "  - REDIS_HOST"
    echo "  - REDIS_PORT"
    echo "  - REDIS_PASSWORD"
    echo "  - NODE_ENV=production"
    echo "  - All other variables from .env.example"
    echo ""
    print_warning "Push to GitHub and Render will deploy automatically"
}

# Main logic
case "$ENVIRONMENT" in
    dev|development)
        check_prerequisites
        setup_dev
        ;;
    prod|production)
        check_prerequisites
        setup_prod_vps
        ;;
    render|render.com)
        check_prerequisites
        setup_render
        ;;
    *)
        print_error "Unknown environment: $ENVIRONMENT"
        echo ""
        echo "Usage: bash setup-docker.sh [environment]"
        echo ""
        echo "Environments:"
        echo "  dev          - Local development (default)"
        echo "  prod         - Production on VPS"
        echo "  render       - Render.com deployment"
        exit 1
        ;;
esac
