import prisma from "../config/prismaConfig.js";

/**
 * Soft Delete Utility Functions
 *
 * This file provides utility functions for implementing soft delete
 * functionality across all models in the application.
 */

/**
 * Soft delete utility class
 */
class SoftDeleteService {
  /**
   * Soft delete a user
   * @param {string} userId - The ID of the user to soft delete
   * @returns {Promise<Object>} - The updated user object
   */
  static async softDeleteUser(userId) {
    return await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft deleted user
   * @param {string} userId - The ID of the user to restore
   * @returns {Promise<Object>} - The restored user object
   */
  static async restoreUser(userId) {
    return await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null },
    });
  }

  /**
   * Soft delete a post
   * @param {string} postId - The ID of the post to soft delete
   * @returns {Promise<Object>} - The updated post object
   */
  static async softDeletePost(postId) {
    return await prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft deleted post
   * @param {string} postId - The ID of the post to restore
   * @returns {Promise<Object>} - The restored post object
   */
  static async restorePost(postId) {
    return await prisma.post.update({
      where: { id: postId },
      data: { deletedAt: null },
    });
  }

  /**
   * Soft delete a page
   * @param {string} pageId - The ID of the page to soft delete
   * @returns {Promise<Object>} - The updated page object
   */
  static async softDeletePage(pageId) {
    return await prisma.page.update({
      where: { id: pageId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft deleted page
   * @param {string} pageId - The ID of the page to restore
   * @returns {Promise<Object>} - The restored page object
   */
  static async restorePage(pageId) {
    return await prisma.page.update({
      where: { id: pageId },
      data: { deletedAt: null },
    });
  }

  /**
   * Soft delete a comment
   * @param {string} commentId - The ID of the comment to soft delete
   * @returns {Promise<Object>} - The updated comment object
   */
  static async softDeleteComment(commentId) {
    return await prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft deleted comment
   * @param {string} commentId - The ID of the comment to restore
   * @returns {Promise<Object>} - The restored comment object
   */
  static async restoreComment(commentId) {
    return await prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: null },
    });
  }

  /**
   * Soft delete a story
   * @param {string} storyId - The ID of the story to soft delete
   * @returns {Promise<Object>} - The updated story object
   */
  static async softDeleteStory(storyId) {
    return await prisma.story.update({
      where: { id: storyId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft deleted story
   * @param {string} storyId - The ID of the story to restore
   * @returns {Promise<Object>} - The restored story object
   */
  static async restoreStory(storyId) {
    return await prisma.story.update({
      where: { id: storyId },
      data: { deletedAt: null },
    });
  }

  /**
   * Soft delete a media file
   * @param {string} mediaId - The ID of the media to soft delete
   * @returns {Promise<Object>} - The updated media object
   */
  static async softDeleteMedia(mediaId) {
    return await prisma.media.update({
      where: { id: mediaId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft deleted media file
   * @param {string} mediaId - The ID of the media to restore
   * @returns {Promise<Object>} - The restored media object
   */
  static async restoreMedia(mediaId) {
    return await prisma.media.update({
      where: { id: mediaId },
      data: { deletedAt: null },
    });
  }

  /**
   * Soft delete a notification
   * @param {string} notificationId - The ID of the notification to soft delete
   * @returns {Promise<Object>} - The updated notification object
   */
  static async softDeleteNotification(notificationId) {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft deleted notification
   * @param {string} notificationId - The ID of the notification to restore
   * @returns {Promise<Object>} - The restored notification object
   */
  static async restoreNotification(notificationId) {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: { deletedAt: null },
    });
  }

  /**
   * Soft delete a follower relationship
   * @param {string} followerId - The ID of the follower relationship to soft delete
   * @returns {Promise<Object>} - The updated follower object
   */
  static async softDeleteFollower(followerId) {
    return await prisma.follower.update({
      where: { id: followerId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft deleted follower relationship
   * @param {string} followerId - The ID of the follower relationship to restore
   * @returns {Promise<Object>} - The restored follower object
   */
  static async restoreFollower(followerId) {
    return await prisma.follower.update({
      where: { id: followerId },
      data: { deletedAt: null },
    });
  }

  /**
   * Soft delete a friendship
   * @param {string} friendshipId - The ID of the friendship to soft delete
   * @returns {Promise<Object>} - The updated friendship object
   */
  static async softDeleteFriendship(friendshipId) {
    return await prisma.friendship.update({
      where: { id: friendshipId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft deleted friendship
   * @param {string} friendshipId - The ID of the friendship to restore
   * @returns {Promise<Object>} - The restored friendship object
   */
  static async restoreFriendship(friendshipId) {
    return await prisma.friendship.update({
      where: { id: friendshipId },
      data: { deletedAt: null },
    });
  }

  /**
   * Soft delete a page member
   * @param {string} memberId - The ID of the page member to soft delete
   * @returns {Promise<Object>} - The updated page member object
   */
  static async softDeletePageMember(memberId) {
    return await prisma.pageMember.update({
      where: { id: memberId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft deleted page member
   * @param {string} memberId - The ID of the page member to restore
   * @returns {Promise<Object>} - The restored page member object
   */
  static async restorePageMember(memberId) {
    return await prisma.pageMember.update({
      where: { id: memberId },
      data: { deletedAt: null },
    });
  }

  /**
   * Soft delete a page follower
   * @param {string} followerId - The ID of the page follower to soft delete
   * @returns {Promise<Object>} - The updated page follower object
   */
  static async softDeletePageFollower(followerId) {
    return await prisma.pageFollower.update({
      where: { id: followerId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft deleted page follower
   * @param {string} followerId - The ID of the page follower to restore
   * @returns {Promise<Object>} - The restored page follower object
   */
  static async restorePageFollower(followerId) {
    return await prisma.pageFollower.update({
      where: { id: followerId },
      data: { deletedAt: null },
    });
  }

  /**
   * Soft delete a reaction
   * @param {string} reactionId - The ID of the reaction to soft delete
   * @returns {Promise<Object>} - The updated reaction object
   */
  static async softDeleteReaction(reactionId) {
    return await prisma.reaction.update({
      where: { id: reactionId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft deleted reaction
   * @param {string} reactionId - The ID of the reaction to restore
   * @returns {Promise<Object>} - The restored reaction object
   */
  static async restoreReaction(reactionId) {
    return await prisma.reaction.update({
      where: { id: reactionId },
      data: { deletedAt: null },
    });
  }

  /**
   * Soft delete a boosted post
   * @param {string} boostedPostId - The ID of the boosted post to soft delete
   * @returns {Promise<Object>} - The updated boosted post object
   */
  static async softDeleteBoostedPost(boostedPostId) {
    return await prisma.boostedPost.update({
      where: { id: boostedPostId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft deleted boosted post
   * @param {string} boostedPostId - The ID of the boosted post to restore
   * @returns {Promise<Object>} - The restored boosted post object
   */
  static async restoreBoostedPost(boostedPostId) {
    return await prisma.boostedPost.update({
      where: { id: boostedPostId },
      data: { deletedAt: null },
    });
  }

  /**
   * Soft delete a sponsored content
   * @param {string} sponsoredId - The ID of the sponsored content to soft delete
   * @returns {Promise<Object>} - The updated sponsored content object
   */
  static async softDeleteSponsored(sponsoredId) {
    return await prisma.sponsored.update({
      where: { id: sponsoredId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft deleted sponsored content
   * @param {string} sponsoredId - The ID of the sponsored content to restore
   * @returns {Promise<Object>} - The restored sponsored content object
   */
  static async restoreSponsored(sponsoredId) {
    return await prisma.sponsored.update({
      where: { id: sponsoredId },
      data: { deletedAt: null },
    });
  }

  /**
   * Soft delete a verification request
   * @param {string} verificationId - The ID of the verification request to soft delete
   * @returns {Promise<Object>} - The updated verification request object
   */
  static async softDeleteVerificationRequest(verificationId) {
    return await prisma.verificationRequest.update({
      where: { id: verificationId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft deleted verification request
   * @param {string} verificationId - The ID of the verification request to restore
   * @returns {Promise<Object>} - The restored verification request object
   */
  static async restoreVerificationRequest(verificationId) {
    return await prisma.verificationRequest.update({
      where: { id: verificationId },
      data: { deletedAt: null },
    });
  }

  /**
   * Generic query builder for excluding soft deleted records
   * @param {Object} whereClause - Existing where clause
   * @param {boolean} includeSoftDeleted - Whether to include soft deleted records
   * @returns {Object} - Modified where clause
   */
  static buildWhereClause(whereClause = {}, includeSoftDeleted = false) {
    if (includeSoftDeleted) {
      return whereClause;
    }

    return {
      ...whereClause,
      deletedAt: null,
    };
  }

  /**
   * Get all soft deleted records for a specific model
   * @param {string} modelName - Name of the model
   * @returns {Promise<Array>} - Array of soft deleted records
   */
  static async getSoftDeletedRecords(modelName) {
    const model = prisma[modelName.toLowerCase()];
    if (!model) {
      throw new Error(`Model ${modelName} not found`);
    }

    return await model.findMany({
      where: {
        deletedAt: {
          not: null,
        },
      },
    });
  }

  /**
   * Permanently delete all soft deleted records older than specified days
   * @param {string} modelName - Name of the model
   * @param {number} days - Number of days old
   * @returns {Promise<Object>} - Delete count
   */
  static async permanentlyDeleteOldRecords(modelName, days = 30) {
    const model = prisma[modelName.toLowerCase()];
    if (!model) {
      throw new Error(`Model ${modelName} not found`);
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await model.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lt: cutoffDate,
        },
      },
    });
  }

  /**
   * Get soft delete statistics for all models
   * @returns {Promise<Object>} - Statistics object
   */
  static async getSoftDeleteStats() {
    const models = [
      "user",
      "post",
      "page",
      "comment",
      "story",
      "media",
      "notification",
      "follower",
      "friendship",
      "pageMember",
      "pageFollower",
      "reaction",
      "boostedPost",
      "sponsored",
      "verificationRequest",
    ];

    const stats = {};

    for (const modelName of models) {
      try {
        const model = prisma[modelName];
        if (model) {
          const [total, softDeleted] = await Promise.all([
            model.count(),
            model.count({
              where: {
                deletedAt: {
                  not: null,
                },
              },
            }),
          ]);

          stats[modelName] = {
            total,
            softDeleted,
            active: total - softDeleted,
          };
        }
      } catch (error) {
        console.error(`Error getting stats for ${modelName}:`, error);
        stats[modelName] = { error: error.message };
      }
    }

    return stats;
  }
}

export { SoftDeleteService };
