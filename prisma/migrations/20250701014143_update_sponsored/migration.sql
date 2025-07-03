-- AlterTable
ALTER TABLE `sponsored` MODIFY `isActive` ENUM('pending', 'accepted', 'rejected', 'expired') NOT NULL DEFAULT 'pending';
