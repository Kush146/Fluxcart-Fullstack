/*
  Warnings:

  - You are about to drop the column `emailSent` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "emailSent";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "addressLine1" VARCHAR(191),
ADD COLUMN     "addressLine2" VARCHAR(191),
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "city" VARCHAR(96),
ADD COLUMN     "country" VARCHAR(64),
ADD COLUMN     "defaultCurrency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "postalCode" VARCHAR(32),
ADD COLUMN     "preferences" JSONB,
ADD COLUMN     "state" VARCHAR(96);
