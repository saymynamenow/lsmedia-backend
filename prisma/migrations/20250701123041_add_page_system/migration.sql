/*
  Warnings:

  - You are about to drop the column `image` on the `page` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `post` DROP FOREIGN KEY `Post_authorId_fkey`;

-- DropIndex
DROP INDEX `Post_authorId_fkey` ON `post`;

-- AlterTable
ALTER TABLE `page` DROP COLUMN `image`,
    ADD COLUMN `isPublic` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `profileImage` LONGTEXT NULL,
    MODIFY `coverImage` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `pagemember` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `role` ENUM('member', 'admin', 'moderator', 'owner') NOT NULL DEFAULT 'member';

-- AlterTable
ALTER TABLE `post` ADD COLUMN `pageId` VARCHAR(191) NULL,
    ADD COLUMN `type` ENUM('user', 'page') NOT NULL DEFAULT 'user',
    MODIFY `authorId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `PageFollower` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PageFollower_userId_pageId_key`(`userId`, `pageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `Page`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PageFollower` ADD CONSTRAINT `PageFollower_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PageFollower` ADD CONSTRAINT `PageFollower_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `Page`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
