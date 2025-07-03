import express from "express";
import { body, param, validationResult } from "express-validator";
import prisma from "../config/prismaConfig.js";
import { NotificationService } from "../services/notificationService.js";
const router = express.Router();

router.post(
  "/:postId/react",
  [
    param("postId").notEmpty().withMessage("Please provide postId"),
    body("type")
      .isIn(["LIKE", "LOVE", "HAHA", "SAD", "WOW", "ANGRY"])
      .withMessage("Invalid reaction type"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { postId } = req.params;
      const { type } = req.body;
      const userId = req.user.userId;

      const existing = await prisma.reaction.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });

      if (!existing) {
        // create new reaction
        const created = await prisma.reaction.create({
          data: {
            userId,
            postId,
            type,
          },
        });

        // Create notification for the reaction
        await NotificationService.createLikeNotification(userId, postId, type);

        return res.status(201).json({ message: "Reacted", reaction: created });
      }

      if (existing.type === type) {
        // same type → remove reaction
        await prisma.reaction.delete({
          where: {
            userId_postId: {
              userId,
              postId,
            },
          },
        });
        return res.status(200).json({ message: "Reaction removed" });
      }

      // different type → update reaction
      const updated = await prisma.reaction.update({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
        data: {
          type,
        },
      });

      // Create notification for the updated reaction
      await NotificationService.createLikeNotification(userId, postId, type);

      return res
        .status(200)
        .json({ message: "Reaction updated", reaction: updated });
    } catch (err) {
      console.error("Error toggling reaction:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

export { router as likeRouter };
