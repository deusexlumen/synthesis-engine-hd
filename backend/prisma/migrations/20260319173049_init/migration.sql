-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'BASIC', 'PREMIUM', 'PRO');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'PAUSED');

-- CreateEnum
CREATE TYPE "EnergyType" AS ENUM ('MANIFESTOR', 'GENERATOR', 'MANIFESTING_GENERATOR', 'PROJECTOR', 'REFLECTOR');

-- CreateEnum
CREATE TYPE "Authority" AS ENUM ('EMOTIONAL', 'SACRAL', 'SPLENIC', 'EGO', 'SELF_PROJECTED', 'MENTAL', 'LUNAR');

-- CreateEnum
CREATE TYPE "CenterName" AS ENUM ('HEAD', 'AJNA', 'THROAT', 'G_CENTER', 'HEART', 'SACRAL', 'ROOT', 'SPLEEN', 'SOLAR_PLEXUS');

-- CreateEnum
CREATE TYPE "Planet" AS ENUM ('SUN', 'EARTH', 'NORTH_NODE', 'SOUTH_NODE', 'MOON', 'MERCURY', 'VENUS', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE', 'PLUTO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" TEXT,
    "passwordResetToken" TEXT,
    "passwordResetAt" TIMESTAMP(3),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "replacedByToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "features" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MillmanProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lifePathString" VARCHAR(10) NOT NULL,
    "root1" INTEGER NOT NULL,
    "root2" INTEGER NOT NULL,
    "baseSum" INTEGER NOT NULL,
    "destinyNumber" INTEGER NOT NULL,
    "hasMasterNumber" BOOLEAN NOT NULL DEFAULT false,
    "hasZeroEnhancer" BOOLEAN NOT NULL DEFAULT false,
    "soulUrgeString" VARCHAR(10),
    "expressionString" VARCHAR(10),
    "personalYear" INTEGER NOT NULL,
    "challenges" JSONB NOT NULL,
    "pinnacles" JSONB NOT NULL,

    CONSTRAINT "MillmanProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HumanDesignProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "energyType" "EnergyType" NOT NULL,
    "authority" "Authority" NOT NULL,
    "profileLine1" INTEGER NOT NULL,
    "profileLine2" INTEGER NOT NULL,
    "incarnationCross" TEXT NOT NULL,
    "variables" JSONB NOT NULL,

    CONSTRAINT "HumanDesignProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartCenter" (
    "id" TEXT NOT NULL,
    "humanDesignProfileId" TEXT NOT NULL,
    "name" "CenterName" NOT NULL,
    "isDefined" BOOLEAN NOT NULL,

    CONSTRAINT "ChartCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartGate" (
    "id" TEXT NOT NULL,
    "humanDesignProfileId" TEXT NOT NULL,
    "gateNumber" INTEGER NOT NULL,
    "line" INTEGER NOT NULL,
    "color" INTEGER NOT NULL,
    "tone" INTEGER NOT NULL,
    "base" INTEGER NOT NULL,
    "planet" "Planet" NOT NULL,
    "isDesign" BOOLEAN NOT NULL,

    CONSTRAINT "ChartGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartChannel" (
    "id" TEXT NOT NULL,
    "humanDesignProfileId" TEXT NOT NULL,
    "gate1" INTEGER NOT NULL,
    "gate2" INTEGER NOT NULL,

    CONSTRAINT "ChartChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneKeysProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lifeWork" INTEGER NOT NULL,
    "evolution" INTEGER NOT NULL,
    "radiance" INTEGER NOT NULL,
    "purpose" INTEGER NOT NULL,
    "attraction" INTEGER NOT NULL,
    "iq" INTEGER NOT NULL,
    "eq" INTEGER NOT NULL,
    "sq" INTEGER NOT NULL,
    "vq" INTEGER NOT NULL,
    "culture" INTEGER NOT NULL,
    "pearl" INTEGER NOT NULL,

    CONSTRAINT "GeneKeysProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneKeyActivation" (
    "id" TEXT NOT NULL,
    "geneKeysProfileId" TEXT NOT NULL,
    "geneKeyNumber" INTEGER NOT NULL,
    "shadow" TEXT NOT NULL,
    "gift" TEXT NOT NULL,
    "siddhi" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GeneKeyActivation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SynthesisCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contextKey" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "generatedText" TEXT NOT NULL,
    "cacheVersion" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SynthesisCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCoaching" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "transitData" JSONB NOT NULL,
    "impulseText" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyCoaching_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransitData" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sunGate" INTEGER NOT NULL,
    "sunLine" INTEGER NOT NULL,
    "moonGate" INTEGER NOT NULL,
    "moonLine" INTEGER NOT NULL,
    "mercuryGate" INTEGER,
    "venusGate" INTEGER,
    "marsGate" INTEGER,
    "jupiterGate" INTEGER,
    "saturnGate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransitData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityStats" (
    "id" TEXT NOT NULL,
    "statType" TEXT NOT NULL,
    "statKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerifyToken_key" ON "User"("emailVerifyToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE INDEX "Permission_resource_idx" ON "Permission"("resource");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_resource_action_key" ON "Permission"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_tier_idx" ON "Subscription"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_subscriptionId_idx" ON "Invoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "Invoice_stripeInvoiceId_idx" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "MillmanProfile_userId_key" ON "MillmanProfile"("userId");

-- CreateIndex
CREATE INDEX "MillmanProfile_destinyNumber_idx" ON "MillmanProfile"("destinyNumber");

-- CreateIndex
CREATE INDEX "MillmanProfile_lifePathString_idx" ON "MillmanProfile"("lifePathString");

-- CreateIndex
CREATE UNIQUE INDEX "HumanDesignProfile_userId_key" ON "HumanDesignProfile"("userId");

-- CreateIndex
CREATE INDEX "HumanDesignProfile_energyType_idx" ON "HumanDesignProfile"("energyType");

-- CreateIndex
CREATE INDEX "HumanDesignProfile_profileLine1_profileLine2_idx" ON "HumanDesignProfile"("profileLine1", "profileLine2");

-- CreateIndex
CREATE INDEX "ChartCenter_name_isDefined_idx" ON "ChartCenter"("name", "isDefined");

-- CreateIndex
CREATE UNIQUE INDEX "ChartCenter_humanDesignProfileId_name_key" ON "ChartCenter"("humanDesignProfileId", "name");

-- CreateIndex
CREATE INDEX "ChartGate_gateNumber_idx" ON "ChartGate"("gateNumber");

-- CreateIndex
CREATE INDEX "ChartGate_planet_idx" ON "ChartGate"("planet");

-- CreateIndex
CREATE UNIQUE INDEX "ChartChannel_humanDesignProfileId_gate1_gate2_key" ON "ChartChannel"("humanDesignProfileId", "gate1", "gate2");

-- CreateIndex
CREATE UNIQUE INDEX "GeneKeysProfile_userId_key" ON "GeneKeysProfile"("userId");

-- CreateIndex
CREATE INDEX "GeneKeysProfile_lifeWork_idx" ON "GeneKeysProfile"("lifeWork");

-- CreateIndex
CREATE UNIQUE INDEX "GeneKeyActivation_geneKeysProfileId_geneKeyNumber_key" ON "GeneKeyActivation"("geneKeysProfileId", "geneKeyNumber");

-- CreateIndex
CREATE INDEX "SynthesisCache_userId_contextKey_idx" ON "SynthesisCache"("userId", "contextKey");

-- CreateIndex
CREATE INDEX "SynthesisCache_expiresAt_idx" ON "SynthesisCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SynthesisCache_userId_contextKey_section_key" ON "SynthesisCache"("userId", "contextKey", "section");

-- CreateIndex
CREATE INDEX "DailyCoaching_userId_date_idx" ON "DailyCoaching"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCoaching_userId_date_key" ON "DailyCoaching"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TransitData_date_key" ON "TransitData"("date");

-- CreateIndex
CREATE INDEX "TransitData_date_idx" ON "TransitData"("date");

-- CreateIndex
CREATE INDEX "CommunityStats_statType_idx" ON "CommunityStats"("statType");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityStats_statType_statKey_key" ON "CommunityStats"("statType", "statKey");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillmanProfile" ADD CONSTRAINT "MillmanProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanDesignProfile" ADD CONSTRAINT "HumanDesignProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartCenter" ADD CONSTRAINT "ChartCenter_humanDesignProfileId_fkey" FOREIGN KEY ("humanDesignProfileId") REFERENCES "HumanDesignProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartGate" ADD CONSTRAINT "ChartGate_humanDesignProfileId_fkey" FOREIGN KEY ("humanDesignProfileId") REFERENCES "HumanDesignProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartChannel" ADD CONSTRAINT "ChartChannel_humanDesignProfileId_fkey" FOREIGN KEY ("humanDesignProfileId") REFERENCES "HumanDesignProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneKeysProfile" ADD CONSTRAINT "GeneKeysProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneKeyActivation" ADD CONSTRAINT "GeneKeyActivation_geneKeysProfileId_fkey" FOREIGN KEY ("geneKeysProfileId") REFERENCES "GeneKeysProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynthesisCache" ADD CONSTRAINT "SynthesisCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCoaching" ADD CONSTRAINT "DailyCoaching_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
