-- AlterTable
ALTER TABLE `media` MODIFY `url` LONGTEXT NOT NULL;

-- AlterTable
ALTER TABLE `post` MODIFY `content` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `birthdate` DATETIME(3) NULL,
    ADD COLUMN `gender` ENUM('male', 'female', 'other') NULL,
    ADD COLUMN `location` VARCHAR(191) NULL,
    ADD COLUMN `relationshipStatus` VARCHAR(191) NULL,
    ADD COLUMN `relationships` VARCHAR(191) NULL,
    ADD COLUMN `studyField` VARCHAR(191) NULL;
