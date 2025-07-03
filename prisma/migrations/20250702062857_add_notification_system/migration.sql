/*
  Warnings:

  - You are about to alter the column `type` on the `notification` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(2))`.
  - Added the required column `title` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `notification` ADD COLUMN `commentId` VARCHAR(191) NULL,
    ADD COLUMN `pageId` VARCHAR(191) NULL,
    ADD COLUMN `postId` VARCHAR(191) NULL,
    ADD COLUMN `senderId` VARCHAR(191) NULL,
    ADD COLUMN `title` VARCHAR(191) NOT NULL,
    MODIFY `type` ENUM('like', 'comment', 'follow', 'friend_request', 'friend_accept', 'page_follow', 'page_like', 'mention') NOT NULL;

-- CreateIndex
CREATE INDEX `Notification_userId_isRead_idx` ON `Notification`(`userId`, `isRead`);

-- CreateIndex
CREATE INDEX `Notification_createdAt_idx` ON `Notification`(`createdAt`);

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `Comment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `Page`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
