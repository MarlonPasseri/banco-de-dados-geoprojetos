ALTER TABLE "User"
  ALTER COLUMN "username" DROP NOT NULL,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "name" TEXT,
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "disabledAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "UserVerificationToken" (
  "id" BIGSERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_emailVerifiedAt_idx" ON "User"("emailVerifiedAt");

CREATE UNIQUE INDEX "UserVerificationToken_tokenHash_key" ON "UserVerificationToken"("tokenHash");
CREATE INDEX "UserVerificationToken_userId_idx" ON "UserVerificationToken"("userId");
CREATE INDEX "UserVerificationToken_expiresAt_idx" ON "UserVerificationToken"("expiresAt");

ALTER TABLE "UserVerificationToken"
  ADD CONSTRAINT "UserVerificationToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
