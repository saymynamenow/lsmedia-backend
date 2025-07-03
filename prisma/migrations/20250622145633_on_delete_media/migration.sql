-- DropForeignKey
ALTER TABLE `media` DROP FOREIGN KEY `Media_postId_fkey`;

-- DropIndex
DROP INDEX `Media_postId_fkey` ON `media`;

-- AddForeignKey
ALTER TABLE `Media` ADD CONSTRAINT `Media_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
