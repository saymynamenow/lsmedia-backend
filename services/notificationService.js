import prisma from "../config/prismaConfig.js";

class NotificationService {
  // Create notification for post like
  static async createLikeNotification(senderId, postId, reactionType) {
    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: {
          id: true,
          content: true,
          authorId: true,
          pageId: true,
          type: true,
          author: {
            select: { id: true, name: true, username: true },
          },
          page: {
            select: { id: true, name: true, ownerId: true },
          },
        },
      });

      if (!post) return;

      // Determine recipient
      const recipientId =
        post.type === "user" ? post.authorId : post.page?.ownerId;

      // Don't notify if user likes their own post
      if (senderId === recipientId) return;

      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { name: true, username: true },
      });

      const reactionEmojis = {
        LIKE: "👍",
        LOVE: "❤️",
        HAHA: "😂",
        WOW: "😮",
        SAD: "😢",
        ANGRY: "😠",
      };

      const title =
        post.type === "user"
          ? `${sender.name} liked your post`
          : `${sender.name} liked your page's post`;

      const content = `${sender.name} reacted with ${
        reactionEmojis[reactionType]
      } to "${post.content?.substring(0, 50)}..."`;

      await prisma.notification.create({
        data: {
          userId: recipientId,
          senderId,
          type: post.type === "user" ? "like" : "page_like",
          title,
          content,
          postId,
          pageId: post.pageId,
        },
      });
    } catch (error) {
      console.error("Error creating like notification:", error);
    }
  }

  // Create notification for comment
  static async createCommentNotification(
    senderId,
    postId,
    commentId,
    commentContent
  ) {
    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: {
          id: true,
          content: true,
          authorId: true,
          pageId: true,
          type: true,
          author: {
            select: { id: true, name: true, username: true },
          },
          page: {
            select: { id: true, name: true, ownerId: true },
          },
        },
      });

      if (!post) return;

      // Determine recipient
      const recipientId =
        post.type === "user" ? post.authorId : post.page?.ownerId;

      // Don't notify if user comments on their own post
      if (senderId === recipientId) return;

      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { name: true, username: true },
      });

      const title =
        post.type === "user"
          ? `${sender.name} commented on your post`
          : `${sender.name} commented on your page's post`;

      const content = `${sender.name}: "${commentContent.substring(
        0,
        100
      )}..."`;

      await prisma.notification.create({
        data: {
          userId: recipientId,
          senderId,
          type: "comment",
          title,
          content,
          postId,
          commentId,
          pageId: post.pageId,
        },
      });
    } catch (error) {
      console.error("Error creating comment notification:", error);
    }
  }

  // Create notification for user follow
  static async createFollowNotification(senderId, followedUserId) {
    try {
      // Don't notify if user follows themselves
      if (senderId === followedUserId) return;

      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { name: true, username: true },
      });

      if (!sender) return;

      await prisma.notification.create({
        data: {
          userId: followedUserId,
          senderId,
          type: "follow",
          title: `${sender.name} started following you`,
          content: `${sender.name} (@${sender.username}) is now following you`,
        },
      });
    } catch (error) {
      console.error("Error creating follow notification:", error);
    }
  }

  // Create notification for page follow
  static async createPageFollowNotification(senderId, pageId) {
    try {
      const page = await prisma.page.findUnique({
        where: { id: pageId },
        select: { id: true, name: true, ownerId: true },
      });

      if (!page || senderId === page.ownerId) return;

      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { name: true, username: true },
      });

      await prisma.notification.create({
        data: {
          userId: page.ownerId,
          senderId,
          type: "page_follow",
          title: `${sender.name} followed your page`,
          content: `${sender.name} started following "${page.name}"`,
          pageId,
        },
      });
    } catch (error) {
      console.error("Error creating page follow notification:", error);
    }
  }

  // Create notification for friend request
  static async createFriendRequestNotification(senderId, receiverId) {
    try {
      if (senderId === receiverId) return;

      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { name: true, username: true },
      });

      await prisma.notification.create({
        data: {
          userId: receiverId,
          senderId,
          type: "friend_request",
          title: `${sender.name} sent you a friend request`,
          content: `${sender.name} (@${sender.username}) wants to be your friend`,
        },
      });
    } catch (error) {
      console.error("Error creating friend request notification:", error);
    }
  }

  // Create notification for friend request accepted
  static async createFriendAcceptNotification(senderId, accepterId) {
    try {
      if (senderId === accepterId) return;

      const accepter = await prisma.user.findUnique({
        where: { id: accepterId },
        select: { name: true, username: true },
      });

      await prisma.notification.create({
        data: {
          userId: senderId,
          senderId: accepterId,
          type: "friend_accept",
          title: `${accepter.name} accepted your friend request`,
          content: `You and ${accepter.name} are now friends!`,
        },
      });
    } catch (error) {
      console.error("Error creating friend accept notification:", error);
    }
  }

  // Get user notifications
  static async getUserNotifications(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where: { userId },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                username: true,
                profilePicture: true,
                isVerified: true,
              },
            },
            post: {
              select: {
                id: true,
                content: true,
                type: true,
                media: {
                  select: {
                    id: true,
                    url: true,
                    type: true,
                  },
                  take: 1,
                },
              },
            },
            page: {
              select: {
                id: true,
                name: true,
                profileImage: true,
              },
            },
            comment: {
              select: {
                id: true,
                content: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.notification.count({ where: { userId } }),
      ]);

      return {
        notifications,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          total,
          hasMore: skip + notifications.length < total,
        },
      };
    } catch (error) {
      console.error("Error fetching notifications:", error);
      throw error;
    }
  }

  // Mark notifications as read
  static async markAsRead(userId, notificationIds) {
    try {
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId, // Ensure user can only update their own notifications
        },
        data: { isRead: true },
      });

      return { success: true };
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      throw error;
    }
  }

  // Get unread count
  static async getUnreadCount(userId) {
    try {
      const count = await prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      });

      return { unreadCount: count };
    } catch (error) {
      console.error("Error getting unread count:", error);
      throw error;
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(userId) {
    try {
      await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: { isRead: true },
      });

      return { success: true };
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }

  // Delete notification
  static async deleteNotification(userId, notificationId) {
    try {
      const deleted = await prisma.notification.delete({
        where: {
          id: notificationId,
          userId, // Ensure user can only delete their own notifications
        },
      });

      return { success: true, deleted };
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  }
}

export { NotificationService };
