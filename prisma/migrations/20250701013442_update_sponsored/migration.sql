/*
  Warnings:

  - You are about to alter the column `isActive` on the `sponsored` table. The data in that column could be lost. The data in that column will be cast from `TinyInt` to `Enum(EnumId(1))`.

*/
-- AlterTable
ALTER TABLE `sponsored` MODIFY `isActive` ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending';
