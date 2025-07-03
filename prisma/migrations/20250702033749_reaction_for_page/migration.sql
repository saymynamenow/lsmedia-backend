-- DropForeignKey
ALTER TABLE `reaction` DROP FOREIGN KEY `Reaction_postId_fkey`;

-- DropIndex
DROP INDEX `Reaction_postId_fkey` ON `reaction`;

-- AlterTable
ALTER TABLE `reaction` ADD COLUMN `pageId` VARCHAR(191) NULL,
    MODIFY `postId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Reaction` ADD CONSTRAINT `Reaction_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reaction` ADD CONSTRAINT `Reaction_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `Page`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
