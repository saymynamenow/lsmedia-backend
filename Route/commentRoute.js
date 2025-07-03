import express from "express";
import { body, param, validationResult } from "express-validator";
import prisma from "../config/prismaConfig.js";
import { NotificationService } from "../services/notificationService.js";

const router = express.Router();

router.post(
  "/:postId",
  [
    body("content").notEmpty().withMessage("Content is required"),
    param("postId").notEmpty().withMessage("Post ID is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { content } = req.body;
      const { postId } = req.params;
      const userId = req.user.userId;

      const comment = await prisma.comment.create({
        data: {
          content,
          postId,
          userId,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              isAdmin: true,
              isProUser: true,
              isVerified: true,
              profilePicture: true,
            },
          },
        },
      });

      // Create notification for the comment
      await NotificationService.createCommentNotification(
        userId,
        postId,
        comment.id,
        content
      );

      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

export { router as commentRouter };
