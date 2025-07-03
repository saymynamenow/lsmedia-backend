/*
  Warnings:

  - You are about to drop the column `authorId` on the `sponsored` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `sponsored` DROP FOREIGN KEY `Sponsored_authorId_fkey`;

-- DropIndex
DROP INDEX `Sponsored_authorId_fkey` ON `sponsored`;

-- AlterTable
ALTER TABLE `sponsored` DROP COLUMN `authorId`;
