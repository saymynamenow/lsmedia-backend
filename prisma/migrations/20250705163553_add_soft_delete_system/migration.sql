-- AlterTable
ALTER TABLE `boosted_post` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `comment` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `follower` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `friendship` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `media` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `filename` VARCHAR(191) NULL,
    ADD COLUMN `mimeType` VARCHAR(191) NULL,
    ADD COLUMN `originalName` VARCHAR(191) NULL,
    ADD COLUMN `size` INTEGER NULL;

-- AlterTable
ALTER TABLE `notification` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `page` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `pagefollower` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `pagemember` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `post` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `reaction` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `sponsored` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `story` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `verificationrequest` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `boosted_post_deletedAt_idx` ON `boosted_post`(`deletedAt`);

-- CreateIndex
CREATE INDEX `comment_deletedAt_idx` ON `comment`(`deletedAt`);

-- CreateIndex
CREATE INDEX `follower_deletedAt_idx` ON `follower`(`deletedAt`);

-- CreateIndex
CREATE INDEX `friendship_deletedAt_idx` ON `friendship`(`deletedAt`);

-- CreateIndex
CREATE INDEX `media_deletedAt_idx` ON `media`(`deletedAt`);

-- CreateIndex
CREATE INDEX `notification_deletedAt_idx` ON `notification`(`deletedAt`);

-- CreateIndex
CREATE INDEX `page_deletedAt_idx` ON `page`(`deletedAt`);

-- CreateIndex
CREATE INDEX `pagefollower_deletedAt_idx` ON `pagefollower`(`deletedAt`);

-- CreateIndex
CREATE INDEX `pagemember_deletedAt_idx` ON `pagemember`(`deletedAt`);

-- CreateIndex
CREATE INDEX `post_deletedAt_idx` ON `post`(`deletedAt`);

-- CreateIndex
CREATE INDEX `reaction_deletedAt_idx` ON `reaction`(`deletedAt`);

-- CreateIndex
CREATE INDEX `sponsored_deletedAt_idx` ON `sponsored`(`deletedAt`);

-- CreateIndex
CREATE INDEX `story_deletedAt_idx` ON `story`(`deletedAt`);

-- CreateIndex
CREATE INDEX `user_deletedAt_idx` ON `user`(`deletedAt`);

-- CreateIndex
CREATE INDEX `verificationrequest_deletedAt_idx` ON `verificationrequest`(`deletedAt`);
