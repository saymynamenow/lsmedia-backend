-- CreateTable
CREATE TABLE `verificationrequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `reason` LONGTEXT NOT NULL,
    `documents` LONGTEXT NULL,
    `status` ENUM('pending', 'accepted', 'rejected', 'expired') NOT NULL DEFAULT 'pending',
    `reviewedBy` VARCHAR(191) NULL,
    `reviewNote` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `reviewedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `verificationrequest` ADD CONSTRAINT `verificationrequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `verificationrequest` ADD CONSTRAINT `verificationrequest_reviewedBy_fkey` FOREIGN KEY (`reviewedBy`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
