-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ORG_USER');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('INITIATED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'NO_ANSWER');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "n8nWebhookUrl" TEXT,
    "retellApiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ORG_USER',
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "retellCallId" TEXT,
    "status" "CallStatus" NOT NULL DEFAULT 'INITIATED',
    "duration" INTEGER,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_summaries" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "transcript" TEXT,
    "summary" TEXT,
    "sentiment" TEXT,
    "keyPoints" TEXT[],
    "actionItems" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_recordings" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "recordingUrl" TEXT NOT NULL,
    "cloudflareR2Url" TEXT,
    "duration" INTEGER,
    "fileSize" INTEGER,
    "format" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "contacts_organizationId_idx" ON "contacts"("organizationId");

-- CreateIndex
CREATE INDEX "contacts_phoneNumber_idx" ON "contacts"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "calls_retellCallId_key" ON "calls"("retellCallId");

-- CreateIndex
CREATE INDEX "calls_organizationId_idx" ON "calls"("organizationId");

-- CreateIndex
CREATE INDEX "calls_contactId_idx" ON "calls"("contactId");

-- CreateIndex
CREATE INDEX "calls_retellCallId_idx" ON "calls"("retellCallId");

-- CreateIndex
CREATE INDEX "calls_status_idx" ON "calls"("status");

-- CreateIndex
CREATE INDEX "calls_createdAt_idx" ON "calls"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "call_summaries_callId_key" ON "call_summaries"("callId");

-- CreateIndex
CREATE INDEX "call_summaries_callId_idx" ON "call_summaries"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "call_recordings_callId_key" ON "call_recordings"("callId");

-- CreateIndex
CREATE INDEX "call_recordings_callId_idx" ON "call_recordings"("callId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_summaries" ADD CONSTRAINT "call_summaries_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_recordings" ADD CONSTRAINT "call_recordings_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
