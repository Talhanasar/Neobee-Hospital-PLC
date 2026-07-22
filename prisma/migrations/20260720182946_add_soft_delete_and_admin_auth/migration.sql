-- CreateEnum
CREATE TYPE "ShareCategory" AS ENUM ('SHAREHOLDER', 'PREMIUM', 'DIRECTOR');

-- CreateEnum
CREATE TYPE "InvestmentStatus" AS ENUM ('PENDING', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPERADMIN');

-- CreateTable
CREATE TABLE "Stakeholder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "nid" TEXT,
    "authUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Stakeholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "uniqueId" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "shares" INTEGER NOT NULL,
    "category" "ShareCategory" NOT NULL,
    "isFoundingEntrepreneur" BOOLEAN NOT NULL DEFAULT false,
    "amount" BIGINT NOT NULL,
    "incentiveAmount" BIGINT NOT NULL DEFAULT 0,
    "depositDate" TIMESTAMP(3),
    "depositMethod" TEXT,
    "paymentReference" TEXT,
    "status" "InvestmentStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "authUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stakeholder_email_key" ON "Stakeholder"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Stakeholder_authUserId_key" ON "Stakeholder"("authUserId");

-- CreateIndex
CREATE INDEX "Stakeholder_deletedAt_idx" ON "Stakeholder"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Investment_uniqueId_key" ON "Investment"("uniqueId");

-- CreateIndex
CREATE UNIQUE INDEX "Investment_verificationCode_key" ON "Investment"("verificationCode");

-- CreateIndex
CREATE INDEX "Investment_stakeholderId_idx" ON "Investment"("stakeholderId");

-- CreateIndex
CREATE INDEX "Investment_status_idx" ON "Investment"("status");

-- CreateIndex
CREATE INDEX "Investment_deletedAt_idx" ON "Investment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_authUserId_key" ON "Admin"("authUserId");

-- CreateIndex
CREATE INDEX "AuditLog_investmentId_idx" ON "AuditLog"("investmentId");

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
