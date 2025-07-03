/*
  Warnings:

  - You are about to drop the column `pageId` on the `reaction` table. All the data in the column will be lost.
  - Made the column `postId` on table `reaction` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `reaction` DROP FOREIGN KEY `Reaction_pageId_fkey`;

-- DropForeignKey
ALTER TABLE `reaction` DROP FOREIGN KEY `Reaction_postId_fkey`;

-- DropIndex
DROP INDEX `Reaction_pageId_fkey` ON `reaction`;

-- DropIndex
DROP INDEX `Reaction_postId_fkey` ON `reaction`;

-- AlterTable
ALTER TABLE `reaction` DROP COLUMN `pageId`,
    MODIFY `postId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `Reaction` ADD CONSTRAINT `Reaction_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
