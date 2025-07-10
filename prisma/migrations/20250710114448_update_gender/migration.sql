-- AlterTable
ALTER TABLE `user` MODIFY `accountStatus` ENUM('active', 'pending', 'inactive', 'suspended', 'rejected', 'deleted') NOT NULL DEFAULT 'pending';
