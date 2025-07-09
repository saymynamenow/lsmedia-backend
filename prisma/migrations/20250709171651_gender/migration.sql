-- AlterTable
ALTER TABLE `user` MODIFY `bio` LONGTEXT NULL,
    MODIFY `gender` ENUM('male', 'female', 'other', 'prefer_not_to_say') NULL;
