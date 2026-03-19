# Account System - Implementation Summary

## Overview
Vollständiges Auth/RBAC/Subscription System für Synthesis Engine mit Supabase PostgreSQL.

## Architecture

### Backend (Node.js + Express + Prisma)
```
backend/
├── src/
│   ├── services/
│   │   └── auth.ts          # Core auth service (JWT, tokens, RBAC)
│   ├── middleware/
│   │   ├── auth.ts          # JWT verification, RBAC guards
│   │   └── errorHandler.ts  # Centralized error handling
│   ├── routes/
│   │   └── auth.ts          # API endpoints
│   └── utils/
│       └── jwt.ts           # JWT utilities
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Default roles & permissions
└── .env                     # Supabase credentials
```

**Features:**
- JWT Access Tokens (15min expiry)
- Refresh Tokens (7 days, httpOnly cookies)
- Token rotation on every refresh
- bcryptjs password hashing (12 rounds)
- RBAC: USER / ADMIN / SUPER_ADMIN roles
- Subscription Tiers: FREE / BASIC / PREMIUM / PRO
- Audit logging for all auth events

### Frontend (React + Zustand + React Router)
```
app/src/
├── stores/
│   └── authStore.ts         # Auth state management
├── components/auth/
│   ├── LoginForm.tsx        # Login UI
│   ├── RegisterForm.tsx     # Registration UI
│   ├── ProtectedRoute.tsx   # Route guards (role/tier based)
│   ├── AdminGuard.tsx       # Component-level permissions
│   └── AuthProvider.tsx     # App initialization
├── lib/
│   └── api-client.ts        # Authenticated API client
└── pages/auth/
    ├── LoginPage.tsx
    └── RegisterPage.tsx
```

**Features:**
- Automatic token refresh
- Persistent sessions
- Role-based route access
- Subscription tier checking
- Password strength indicator
- Form validation

## Database Schema

### Core Auth Tables
- `User`: id, email, passwordHash, status
- `Role`: USER, ADMIN, SUPER_ADMIN
- `Permission`: resource:action format
- `UserRole`: junction table
- `RolePermission`: junction table
- `Subscription`: tier, status, Stripe integration
- `RefreshToken`: token rotation tracking
- `AuditLog`: security event logging

### RBAC Permissions
```typescript
// User permissions
user:read, user:update, user:delete

// Chart permissions
chart:create, chart:read, chart:update, chart:delete

// Coaching permissions  
coaching:access, coaching:unlimited

// Export permissions
export:pdf, export:png, export:svg, export:json

// Admin permissions
admin:access, user:manage, role:manage
```

### Subscription Tiers
```typescript
FREE:    { maxCharts: 1,  aiCoach: false, exportFormats: ['pdf'] }
BASIC:   { maxCharts: 5,  aiCoach: false, exportFormats: ['pdf', 'png'] }
PREMIUM: { maxCharts: -1, aiCoach: true,  exportFormats: ['pdf', 'png', 'svg', 'json'] }
PRO:     { maxCharts: -1, aiCoach: true,  apiAccess: true, webhooks: true }
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | - | Create account |
| POST | /api/auth/login | - | Authenticate |
| POST | /api/auth/refresh | Cookie | Refresh tokens |
| POST | /api/auth/logout | JWT | Revoke session |
| GET | /api/auth/me | JWT | Get profile |
| POST | /api/auth/change-password | JWT | Update password |
| POST | /api/auth/forgot-password | - | Reset request |
| POST | /api/auth/reset-password | - | Confirm reset |

## Frontend Usage

### Protected Routes
```tsx
import { ProtectedRoute, AdminRoute, TierRoute } from '@/components/auth';

// Any authenticated user
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>

// Admin only
<AdminRoute>
  <AdminPanel />
</AdminRoute>

// Subscription tier
<TierRoute tier="PREMIUM">
  <PremiumFeature />
</TierRoute>
```

### Component Guards
```tsx
import { AdminGuard, FeatureGuard, SubscriptionGuard } from '@/components/auth';

<AdminGuard>
  <DeleteUserButton />
</AdminGuard>

<FeatureGuard feature="aiCoach" fallback={<UpgradePrompt />}>
  <AICoach />
</FeatureGuard>

<SubscriptionGuard minTier="BASIC">
  <AdvancedCharts />
</SubscriptionGuard>
```

### Auth Store
```tsx
import { useAuthStore } from '@/stores/authStore';

const { 
  user, 
  isAuthenticated, 
  login, 
  logout,
  hasRole,
  hasTier 
} = useAuthStore();

// Check permissions
if (hasRole(['ADMIN'])) { ... }
if (hasTier('PREMIUM')) { ... }
```

## Setup Instructions

### 1. Supabase Setup
```bash
# 1. Create project at https://supabase.com
# 2. Go to Settings > Database
# 3. Copy connection strings
```

### 2. Environment Variables
Create `backend/.env`:
```env
# Database
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"

# Auth
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
JWT_EXPIRES_IN="15m"
REFRESH_TOKEN_EXPIRES_IN="7d"

# Frontend URL
FRONTEND_URL="http://localhost:5173"
```

### 3. Database Migration
```bash
cd backend
npx prisma migrate dev --name init_auth_rbac
npx prisma db seed
```

### 4. Start Backend
```bash
npm run dev
```

### 5. Start Frontend
```bash
cd app
npm run dev
```

## Security Features

- ✅ Password hashing with bcryptjs (12 rounds)
- ✅ JWT with short expiry (15 min)
- ✅ Refresh token rotation
- ✅ httpOnly, Secure, SameSite=Strict cookies
- ✅ Input validation with Zod
- ✅ SQL injection protection via Prisma
- ✅ XSS protection via React escape
- ✅ Role-based access control
- ✅ Audit logging
- ✅ Rate limiting ready

## Next Steps

1. **Supabase Connection**: Add your DATABASE_URL to `backend/.env`
2. **Run Migration**: Execute `npx prisma migrate dev`
3. **Seed Database**: Execute `npx prisma db seed`
4. **Test Auth**: Register/login via frontend
5. **Stripe Integration**: Add payment for subscriptions
6. **Email Service**: Add verification & password reset emails
