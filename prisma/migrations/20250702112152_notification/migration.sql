-- AlterTable
ALTER TABLE `pagemember` ADD COLUMN `status` ENUM('pending', 'accepted', 'rejected', 'expired') NOT NULL DEFAULT 'pending';
