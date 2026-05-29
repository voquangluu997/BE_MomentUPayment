/*
  Warnings:

  - You are about to drop the column `body` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Notification` table. All the data in the column will be lost.
  - Added the required column `bodyKey` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `titleKey` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "body",
DROP COLUMN "title",
ADD COLUMN     "arguments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "bodyKey" TEXT NOT NULL,
ADD COLUMN     "titleKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notiBudgetAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notiSecuritySystem" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notiSharedWallet" BOOLEAN NOT NULL DEFAULT true;
