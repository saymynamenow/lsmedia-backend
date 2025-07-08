-- CreateTable
CREATE TABLE `report` (
    `id` VARCHAR(191) NOT NULL,
    `reporterId` VARCHAR(191) NOT NULL,
    `reportType` ENUM('post', 'comment', 'account', 'page') NOT NULL,
    `reason` ENUM('spam', 'harassment', 'hate_speech', 'violence', 'nudity', 'false_information', 'intellectual_property', 'self_harm', 'terrorism', 'bullying', 'impersonation', 'other') NOT NULL,
    `description` LONGTEXT NULL,
    `status` ENUM('pending', 'accepted', 'rejected', 'expired') NOT NULL DEFAULT 'pending',
    `postId` VARCHAR(191) NULL,
    `commentId` VARCHAR(191) NULL,
    `accountId` VARCHAR(191) NULL,
    `pageId` VARCHAR(191) NULL,
    `reviewedBy` VARCHAR(191) NULL,
    `reviewNote` LONGTEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `actionTaken` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `report_reporterId_idx`(`reporterId`),
    INDEX `report_reportType_idx`(`reportType`),
    INDEX `report_status_idx`(`status`),
    INDEX `report_createdAt_idx`(`createdAt`),
    INDEX `report_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `report` ADD CONSTRAINT `report_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report` ADD CONSTRAINT `report_reviewedBy_fkey` FOREIGN KEY (`reviewedBy`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report` ADD CONSTRAINT `report_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report` ADD CONSTRAINT `report_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `comment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report` ADD CONSTRAINT `report_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report` ADD CONSTRAINT `report_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `page`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
