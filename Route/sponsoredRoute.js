import express from "express";
import { body, check, param, query, validationResult } from "express-validator";
import prisma from "../config/prismaConfig.js";
import { upload } from "../config/multer.js";

const router = express.Router();

// Helper function to update expired sponsored posts
async function updateExpiredPosts() {
  try {
    const now = new Date();

    const updatedPosts = await prisma.sponsored.updateMany({
      where: {
        endDate: {
          lt: now, // Less than current date/time
        },
        isActive: {
          in: ["accepted", "pending"], // Only update accepted or pending posts
        },
        deletedAt: null,
      },
      data: {
        isActive: "expired",
      },
    });

    return updatedPosts.count;
  } catch (error) {
    console.error("Error updating expired posts:", error);
    return 0;
  }
}

router.get(
  "/",
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("status")
      .optional()
      .isIn(["pending", "accepted", "rejected", "expired"])
      .withMessage(
        "Status must be one of: pending, accepted, rejected, expired"
      ),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // First, update any expired posts
      const expiredCount = await updateExpiredPosts();

      const { page, limit, status } = req.query;
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause = { deletedAt: null };
      if (status) {
        whereClause.isActive = status;
      }

      const sponsoredPosts = await prisma.sponsored.findMany({
        where: whereClause,
        skip: parseInt(skip) || 0,
        take: parseInt(limit) || 10,
        orderBy: { createdAt: "desc" },
      });

      // Get total count for pagination
      const totalCount = await prisma.sponsored.count({
        where: whereClause,
      });

      res.status(200).json({
        posts: sponsoredPosts,
        pagination: {
          currentPage: parseInt(page) || 1,
          totalPages: Math.ceil(totalCount / (parseInt(limit) || 10)),
          totalPosts: totalCount,
          hasMore: (parseInt(skip) || 0) + sponsoredPosts.length < totalCount,
        },
        ...(expiredCount > 0 && { expiredPostsUpdated: expiredCount }),
      });
    } catch (error) {
      console.error("Error fetching sponsored posts:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.put(
  "/accept/:id",
  [param("id").notEmpty().withMessage("Invalid ID format")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;

      // Check if the post exists and is not expired
      const existingPost = await prisma.sponsored.findUnique({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existingPost) {
        return res.status(404).json({ message: "Sponsored post not found" });
      }

      // Check if the post has expired
      const now = new Date();
      if (existingPost.endDate < now) {
        // Update to expired status
        await prisma.sponsored.update({
          where: { id },
          data: { isActive: "expired" },
        });
        return res.status(400).json({
          message: "Cannot accept expired sponsored post",
          post: { ...existingPost, isActive: "expired" },
        });
      }

      const updatedPost = await prisma.sponsored.update({
        where: { id },
        data: { isActive: "accepted" },
      });

      res.status(200).json(updatedPost);
    } catch (error) {
      console.error("Error accepting sponsored post:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.delete(
  "/:id",
  [param("id").notEmpty().withMessage("Invalid ID format")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;

      // Check if the post exists
      const existingPost = await prisma.sponsored.findUnique({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existingPost) {
        return res.status(404).json({ message: "Sponsored post not found" });
      }

      // Soft delete the sponsored post
      await prisma.sponsored.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      res.status(200).json({ message: "Sponsored post deleted successfully" });
    } catch (error) {
      console.error("Error deleting sponsored post:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.patch(
  "/:id",
  upload.single("image"),
  [
    param("id").notEmpty().withMessage("Invalid ID format"),
    body("title").optional().notEmpty().withMessage("Title cannot be empty"),
    body("content")
      .optional()
      .notEmpty()
      .withMessage("Content cannot be empty"),
    body("startDate")
      .optional()
      .isISO8601()
      .toDate()
      .withMessage("Start date must be a valid date"),
    body("endDate")
      .optional()
      .isISO8601()
      .toDate()
      .withMessage("End date must be a valid date")
      .custom((endDate, { req }) => {
        if (endDate && req.body.startDate) {
          const startDate = new Date(req.body.startDate);
          if (endDate <= startDate) {
            throw new Error("End date must be after start date");
          }
        }
        return true;
      }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { title, content, startDate, endDate, link } = req.body;
      const uploadedFile = req.file;

      // Check if the post exists
      const existingPost = await prisma.sponsored.findUnique({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existingPost) {
        return res.status(404).json({ message: "Sponsored post not found" });
      }

      // Prepare update data
      const updateData = {};

      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
      if (startDate !== undefined) updateData.startDate = new Date(startDate);
      if (endDate !== undefined) updateData.endDate = new Date(endDate);
      if (link !== undefined) updateData.link = link;

      // Handle image upload
      if (uploadedFile) {
        updateData.imageUrl = `/uploads/${uploadedFile.filename}`;
      }

      // Update the sponsored post
      const updatedPost = await prisma.sponsored.update({
        where: { id },
        data: updateData,
      });

      res.status(200).json({
        message: "Sponsored post updated successfully",
        sponsoredPost: updatedPost,
        imageUpdated: !!uploadedFile,
        imagePath: uploadedFile ? updateData.imageUrl : existingPost.imageUrl,
      });
    } catch (error) {
      console.error("Error updating sponsored post:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.put(
  "/reject/:id",
  [check("id").notEmpty().withMessage("Invalid ID format")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;

      const updatedPost = await prisma.sponsored.update({
        where: {
          id,
          deletedAt: null,
        },
        data: { isActive: "rejected" },
      });

      res.status(200).json(updatedPost);
    } catch (error) {
      console.error("Error rejecting sponsored post:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.post(
  "/createsponsored",
  upload.single("image"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("content").notEmpty().withMessage("Content is required"),
    body("startDate")
      .notEmpty()
      .withMessage("Start date is required")
      .isISO8601()
      .toDate()
      .withMessage("Start date must be a valid date"),
    body("endDate")
      .notEmpty()
      .withMessage("End date is required")
      .isISO8601()
      .toDate()
      .withMessage("End date must be a valid date")
      .custom((endDate, { req }) => {
        const startDate = new Date(req.body.startDate);
        if (endDate <= startDate) {
          throw new Error("End date must be after start date");
        }

        const now = new Date();
        if (endDate <= now) {
          throw new Error("End date must be in the future");
        }

        return true;
      }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, content, startDate, endDate } = req.body;
      const uploadedFile = req.file;
      console.log(uploadedFile);

      // Prepare the image URL
      let imageUrl = null;
      if (uploadedFile) {
        // Use the uploaded file path
        imageUrl = `/${uploadedFile.filename}`;
      }

      const sponsoredPost = await prisma.sponsored.create({
        data: {
          title,
          content,
          imageUrl,
          isActive: "pending",
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        },
      });

      return res.status(201).json({
        message: "Sponsored post created successfully",
        sponsoredPost,
        imageUploaded: !!uploadedFile,
        imagePath: imageUrl,
      });
    } catch (error) {
      console.log("Error creating sponsored post:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// New endpoint to manually update expired posts
router.put("/update-expired", async (req, res) => {
  try {
    const expiredCount = await updateExpiredPosts();

    res.status(200).json({
      message: `Successfully updated ${expiredCount} expired posts`,
      expiredPostsUpdated: expiredCount,
    });
  } catch (error) {
    console.error("Error updating expired posts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get active sponsored posts only (for frontend display)
router.get("/active", async (req, res) => {
  try {
    // Update expired posts first
    await updateExpiredPosts();

    const now = new Date();

    const activePosts = await prisma.sponsored.findMany({
      where: {
        isActive: "accepted",
        deletedAt: null,
        startDate: {
          lte: now, // Start date is less than or equal to now
        },
        endDate: {
          gt: now, // End date is greater than now
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(activePosts);
  } catch (error) {
    console.error("Error fetching active sponsored posts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export { router as sponsoredRouter };
