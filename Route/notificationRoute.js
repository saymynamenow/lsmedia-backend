import express from "express";
import { query, body, param, validationResult } from "express-validator";
import { authentication } from "../middleware/authenticantion.js";
import { NotificationService } from "../services/notificationService.js";
import prisma from "../config/prismaConfig.js";

const router = express.Router();

// Get user notifications
router.get(
  "/",
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
    query("unreadOnly")
      .optional()
      .isBoolean()
      .withMessage("unreadOnly must be a boolean"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const unreadOnly = req.query.unreadOnly === "true";

      const result = await NotificationService.getUserNotifications(
        userId,
        page,
        limit,
        unreadOnly
      );

      return res.status(200).json(result);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Mark notifications as read
router.put(
  "/read",
  [
    body("notificationIds")
      .isArray({ min: 1 })
      .withMessage("Notification IDs must be a non-empty array"),
    body("notificationIds.*")
      .isString()
      .withMessage("Each notification ID must be a string"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const userId = req.user.userId;
      const { notificationIds } = req.body;

      await NotificationService.markAsRead(userId, notificationIds);

      return res.status(200).json({
        message: "Notifications marked as read",
      });
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get unread count
router.get("/unread-count", authentication, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await NotificationService.getUnreadCount(userId);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error getting unread count:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Mark all as read
router.put("/read-all", authentication, async (req, res) => {
  try {
    const userId = req.user.userId;
    await NotificationService.markAllAsRead(userId);

    return res.status(200).json({
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Delete notification
router.delete(
  "/:notificationId",
  [
    param("notificationId")
      .notEmpty()
      .withMessage("Notification ID is required"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { notificationId } = req.params;

      await NotificationService.deleteNotification(userId, notificationId);

      return res.status(200).json({
        message: "Notification deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting notification:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get notification by ID
router.get(
  "/:notificationId",
  [
    param("notificationId")
      .notEmpty()
      .withMessage("Notification ID is required"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { notificationId } = req.params;

      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId, // Ensure user can only access their own notifications
        },
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
      });

      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      // Mark as read when viewed
      if (!notification.isRead) {
        await prisma.notification.update({
          where: { id: notificationId },
          data: { isRead: true },
        });
        notification.isRead = true;
      }

      return res.status(200).json({ notification });
    } catch (error) {
      console.error("Error fetching notification:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

export { router as notificationRouter };
