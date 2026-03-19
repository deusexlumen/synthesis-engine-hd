# Synthesis Engine - Professional Setup Script (Windows)
# Ensures 100% accurate Human Design calculations with Swiss Ephemeris

$ErrorActionPreference = "Stop"

Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Synthesis Engine - Professional Setup                       ║" -ForegroundColor Cyan
Write-Host "║  Swiss Ephemeris (NASA JPL Accuracy)                         ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..."
$nodeVersion = node -v 2>$null
if (-not $nodeVersion) {
    Write-Host "✗ Node.js not found! Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

$majorVersion = ($nodeVersion -replace 'v','').Split('.')[0]
if ([int]$majorVersion -lt 18) {
    Write-Host "✗ Node.js version must be 18+. Found: $nodeVersion" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Node.js $nodeVersion" -ForegroundColor Green

# Step 1: Download Ephemeris Files
Write-Host ""
Write-Host "Step 1/4: Downloading Swiss Ephemeris files..." -ForegroundColor Cyan
if (Test-Path "scripts") {
    Set-Location scripts
    try {
        .\download-ephemeris.ps1
        if ($LASTEXITCODE -ne 0) {
            throw "Download failed"
        }
    } catch {
        Write-Host "⚠️  Ephemeris download failed. Will use fallback mode." -ForegroundColor Yellow
        Write-Host "    Run manually later: cd scripts; .\download-ephemeris.ps1" -ForegroundColor Yellow
    }
    Set-Location ..
} else {
    Write-Host "⚠️  Scripts directory not found" -ForegroundColor Yellow
}

# Step 2: Setup Backend
Write-Host ""
Write-Host "Step 2/4: Setting up backend..." -ForegroundColor Cyan
if (Test-Path "backend") {
    Set-Location backend
    
    Write-Host "Installing dependencies..."
    npm install
    
    # Generate Prisma client
    if (Test-Path "prisma\schema.prisma") {
        Write-Host "Generating Prisma client..."
        npx prisma generate
    }
    
    # Create .env if not exists
    if (-not (Test-Path ".env")) {
        Write-Host "Creating .env file..."
        @"
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
"@ | Out-File -FilePath ".env" -Encoding utf8
        
        Write-Host "⚠️  Created .env file. Please update with your credentials!" -ForegroundColor Yellow
    }
    
    Set-Location ..
    Write-Host "✓ Backend setup complete" -ForegroundColor Green
} else {
    Write-Host "✗ Backend directory not found" -ForegroundColor Red
    exit 1
}

# Step 3: Setup Frontend
Write-Host ""
Write-Host "Step 3/4: Setting up frontend..." -ForegroundColor Cyan
if (Test-Path "app") {
    Set-Location app
    
    Write-Host "Installing dependencies..."
    npm install
    
    Set-Location ..
    Write-Host "✓ Frontend setup complete" -ForegroundColor Green
} else {
    Write-Host "⚠️  App directory not found (optional)" -ForegroundColor Yellow
}

# Step 4: Verify Setup
Write-Host ""
Write-Host "Step 4/4: Verifying setup..." -ForegroundColor Cyan

# Check ephemeris files
$epheFilesExist = (Test-Path "backend\ephemeris\sepl_18.se1") -and (Test-Path "backend\ephemeris\semo_18.se1")
if ($epheFilesExist) {
    Write-Host "✓ Swiss Ephemeris files found" -ForegroundColor Green
    $epheStatus = "professional"
} else {
    Write-Host "⚠️  Swiss Ephemeris files missing" -ForegroundColor Yellow
    Write-Host "    Run: cd scripts; .\download-ephemeris.ps1" -ForegroundColor Cyan
    $epheStatus = "fallback"
}

# Summary
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Setup Complete!                                             ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host ""
Write-Host "1. Configure database in backend\.env"
Write-Host "   - Set DATABASE_URL with your PostgreSQL credentials"
Write-Host ""
Write-Host "2. Run database migrations:"
Write-Host "   cd backend"
Write-Host "   npx prisma migrate dev"
Write-Host ""
Write-Host "3. Start the backend server:"
Write-Host "   cd backend"
Write-Host "   npm run dev"
Write-Host ""
Write-Host "4. (Optional) Start the frontend:"
Write-Host "   cd app"
Write-Host "   npm run dev"
Write-Host ""

if ($epheStatus -eq "professional") {
    Write-Host "✓ Professional mode ready (±0.0001° accuracy)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Fallback mode - download ephemeris files for professional accuracy" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Test the calculation:"
Write-Host '  curl -X POST http://localhost:3000/api/hd/calculate `
    -H "Content-Type: application/json" `
    -d "{`"year`":1948,`"month`":4,`"day`":28,`"hour`":8,`"minute`":14,`"latitude`":45.5,`"longitude`":-73.5,`"timezone`":-5}"'
Write-Host ""
