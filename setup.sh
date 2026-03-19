#!/bin/bash
# Synthesis Engine - Professional Setup Script
# Ensures 100% accurate Human Design calculations with Swiss Ephemeris

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Synthesis Engine - Professional Setup                       ║${NC}"
echo -e "${CYAN}║  Swiss Ephemeris (NASA JPL Accuracy)                         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Node.js version
echo "Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found! Please install Node.js 18+${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js version must be 18+. Found: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# Step 1: Download Ephemeris Files
echo ""
echo -e "${CYAN}Step 1/4: Downloading Swiss Ephemeris files...${NC}"
if [ -d "scripts" ]; then
    cd scripts
    chmod +x download-ephemeris.sh
    ./download-ephemeris.sh || {
        echo -e "${YELLOW}⚠️  Ephemeris download failed. Will use fallback mode.${NC}"
        echo -e "${YELLOW}    Run manually later: cd scripts && ./download-ephemeris.sh${NC}"
    }
    cd ..
else
    echo -e "${YELLOW}⚠️  Scripts directory not found${NC}"
fi

# Step 2: Setup Backend
echo ""
echo -e "${CYAN}Step 2/4: Setting up backend...${NC}"
if [ -d "backend" ]; then
    cd backend
    
    echo "Installing dependencies..."
    npm install
    
    # Generate Prisma client
    if [ -f "prisma/schema.prisma" ]; then
        echo "Generating Prisma client..."
        npx prisma generate
    fi
    
    # Create .env if not exists
    if [ ! -f ".env" ]; then
        echo "Creating .env file..."
        cat > .env << 'EOF'
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/synthesis?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/synthesis?schema=public"

# Auth
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# AI Services (optional)
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""

# Server
PORT=3000
NODE_ENV=development

# Ephemeris (auto-detected if not set)
# SE_EPHE_PATH="./ephemeris"
EOF
        echo -e "${YELLOW}⚠️  Created .env file. Please update with your credentials!${NC}"
    fi
    
    cd ..
    echo -e "${GREEN}✓ Backend setup complete${NC}"
else
    echo -e "${RED}✗ Backend directory not found${NC}"
    exit 1
fi

# Step 3: Setup Frontend (App)
echo ""
echo -e "${CYAN}Step 3/4: Setting up frontend...${NC}"
if [ -d "app" ]; then
    cd app
    
    echo "Installing dependencies..."
    npm install
    
    cd ..
    echo -e "${GREEN}✓ Frontend setup complete${NC}"
else
    echo -e "${YELLOW}⚠️  App directory not found (optional)${NC}"
fi

# Step 4: Verify Setup
echo ""
echo -e "${CYAN}Step 4/4: Verifying setup...${NC}"

# Check ephemeris files
if [ -f "backend/ephemeris/sepl_18.se1" ] && [ -f "backend/ephemeris/semo_18.se1" ]; then
    echo -e "${GREEN}✓ Swiss Ephemeris files found${NC}"
    EPHE_STATUS="professional"
else
    echo -e "${YELLOW}⚠️  Swiss Ephemeris files missing${NC}"
    echo -e "    Run: ${CYAN}cd scripts && ./download-ephemeris.sh${NC}"
    EPHE_STATUS="fallback"
fi

# Summary
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Setup Complete!                                             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure database in backend/.env"
echo "   - Set DATABASE_URL with your PostgreSQL credentials"
echo ""
echo "2. Run database migrations:"
echo "   cd backend && npx prisma migrate dev"
echo ""
echo "3. Start the backend server:"
echo "   cd backend && npm run dev"
echo ""
echo "4. (Optional) Start the frontend:"
echo "   cd app && npm run dev"
echo ""

if [ "$EPHE_STATUS" = "professional" ]; then
    echo -e "${GREEN}✓ Professional mode ready (±0.0001° accuracy)${NC}"
else
    echo -e "${YELLOW}⚠️  Fallback mode - download ephemeris files for professional accuracy${NC}"
fi

echo ""
echo "Test the calculation:"
echo "  curl -X POST http://localhost:3000/api/hd/calculate \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"year\":1948,\"month\":4,\"day\":28,\"hour\":8,\"minute\":14,\"latitude\":45.5,\"longitude\":-73.5,\"timezone\":-5}'"
echo ""
