-- DropForeignKey
ALTER TABLE `comment` DROP FOREIGN KEY `Comment_postId_fkey`;

-- DropForeignKey
ALTER TABLE `comment` DROP FOREIGN KEY `Comment_userId_fkey`;

-- DropForeignKey
ALTER TABLE `follower` DROP FOREIGN KEY `Follower_followerId_fkey`;

-- DropForeignKey
ALTER TABLE `follower` DROP FOREIGN KEY `Follower_followingId_fkey`;

-- DropForeignKey
ALTER TABLE `friendship` DROP FOREIGN KEY `Friendship_userAId_fkey`;

-- DropForeignKey
ALTER TABLE `friendship` DROP FOREIGN KEY `Friendship_userBId_fkey`;

-- DropForeignKey
ALTER TABLE `media` DROP FOREIGN KEY `Media_postId_fkey`;

-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `Notification_commentId_fkey`;

-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `Notification_pageId_fkey`;

-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `Notification_postId_fkey`;

-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `Notification_senderId_fkey`;

-- DropForeignKey
ALTER TABLE `notification` DROP FOREIGN KEY `Notification_userId_fkey`;

-- DropForeignKey
ALTER TABLE `page` DROP FOREIGN KEY `Page_ownerId_fkey`;

-- DropForeignKey
ALTER TABLE `pagefollower` DROP FOREIGN KEY `PageFollower_pageId_fkey`;

-- DropForeignKey
ALTER TABLE `pagefollower` DROP FOREIGN KEY `PageFollower_userId_fkey`;

-- DropForeignKey
ALTER TABLE `pagemember` DROP FOREIGN KEY `PageMember_pageId_fkey`;

-- DropForeignKey
ALTER TABLE `pagemember` DROP FOREIGN KEY `PageMember_userId_fkey`;

-- DropForeignKey
ALTER TABLE `post` DROP FOREIGN KEY `Post_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `post` DROP FOREIGN KEY `Post_pageId_fkey`;

-- DropForeignKey
ALTER TABLE `reaction` DROP FOREIGN KEY `Reaction_postId_fkey`;

-- DropForeignKey
ALTER TABLE `reaction` DROP FOREIGN KEY `Reaction_userId_fkey`;

-- DropForeignKey
ALTER TABLE `story` DROP FOREIGN KEY `Story_authorId_fkey`;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `idCard` LONGTEXT NULL,
    MODIFY `accountStatus` ENUM('active', 'pending', 'inactive', 'suspended', 'deleted') NOT NULL DEFAULT 'pending';

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `comment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `page`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post` ADD CONSTRAINT `post_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post` ADD CONSTRAINT `post_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `page`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media` ADD CONSTRAINT `media_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `story` ADD CONSTRAINT `story_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follower` ADD CONSTRAINT `follower_followerId_fkey` FOREIGN KEY (`followerId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follower` ADD CONSTRAINT `follower_followingId_fkey` FOREIGN KEY (`followingId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `friendship` ADD CONSTRAINT `friendship_userAId_fkey` FOREIGN KEY (`userAId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `friendship` ADD CONSTRAINT `friendship_userBId_fkey` FOREIGN KEY (`userBId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `page` ADD CONSTRAINT `page_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagemember` ADD CONSTRAINT `pagemember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagemember` ADD CONSTRAINT `pagemember_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `page`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reaction` ADD CONSTRAINT `reaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reaction` ADD CONSTRAINT `reaction_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment` ADD CONSTRAINT `comment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment` ADD CONSTRAINT `comment_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagefollower` ADD CONSTRAINT `pagefollower_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagefollower` ADD CONSTRAINT `pagefollower_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `page`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `follower` RENAME INDEX `Follower_followerId_followingId_key` TO `follower_followerId_followingId_key`;

-- RenameIndex
ALTER TABLE `friendship` RENAME INDEX `Friendship_userAId_userBId_key` TO `friendship_userAId_userBId_key`;

-- RenameIndex
ALTER TABLE `notification` RENAME INDEX `Notification_createdAt_idx` TO `notification_createdAt_idx`;

-- RenameIndex
ALTER TABLE `notification` RENAME INDEX `Notification_userId_isRead_idx` TO `notification_userId_isRead_idx`;

-- RenameIndex
ALTER TABLE `pagefollower` RENAME INDEX `PageFollower_userId_pageId_key` TO `pagefollower_userId_pageId_key`;

-- RenameIndex
ALTER TABLE `pagemember` RENAME INDEX `PageMember_userId_pageId_key` TO `pagemember_userId_pageId_key`;

-- RenameIndex
ALTER TABLE `reaction` RENAME INDEX `Reaction_userId_postId_key` TO `reaction_userId_postId_key`;

-- RenameIndex
ALTER TABLE `user` RENAME INDEX `User_email_key` TO `user_email_key`;

-- RenameIndex
ALTER TABLE `user` RENAME INDEX `User_username_key` TO `user_username_key`;
