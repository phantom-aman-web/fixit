-- CreateTable
CREATE TABLE "EquipmentErrorCode" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "brand" TEXT,
    "modelPattern" TEXT,
    "code" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'NORMAL',
    "riskLevel" TEXT NOT NULL DEFAULT 'SAFE',
    "possibleCauses" TEXT,
    "recommendedActions" TEXT,
    "professionalRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentErrorCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIChat" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Diagnosis',
    "messagesJson" TEXT NOT NULL DEFAULT '[]',
    "diagnosticSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipmentErrorCode_categoryId_code_idx" ON "EquipmentErrorCode"("categoryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AIChat_diagnosticSessionId_key" ON "AIChat"("diagnosticSessionId");

-- CreateIndex
CREATE INDEX "AIChat_customerId_updatedAt_idx" ON "AIChat"("customerId", "updatedAt");

-- AddForeignKey
ALTER TABLE "EquipmentErrorCode" ADD CONSTRAINT "EquipmentErrorCode_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EquipmentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIChat" ADD CONSTRAINT "AIChat_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
