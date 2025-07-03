/*
  Warnings:

  - You are about to alter the column `role` on the `pagemember` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(3))`.
  - Added the required column `updatedAt` to the `Page` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `page` ADD COLUMN `category` VARCHAR(191) NULL,
    ADD COLUMN `coverImage` VARCHAR(191) NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `isVerified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `pagemember` MODIFY `role` ENUM('member', 'admin', 'moderator') NOT NULL DEFAULT 'member';

-- AlterTable
ALTER TABLE `user` ADD COLUMN `accountStatus` ENUM('active', 'suspended', 'deleted') NOT NULL DEFAULT 'active';
