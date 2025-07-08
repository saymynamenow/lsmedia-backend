import express from "express";
import prisma from "../config/prismaConfig.js";
import { body, query, param, validationResult } from "express-validator";
import { upload } from "../config/multer.js";
import { authentication } from "../middleware/authenticantion.js";
const router = express.Router();

router.get(
  "/search",
  [query("name").notEmpty().withMessage("Query is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const q = req.query.name;

      const users = await prisma.user.findMany({
        where: {
          OR: [{ username: { contains: q } }, { name: { contains: q } }],
        },
        select: {
          id: true,
          username: true,
          name: true,
          profilePicture: true,
        },
      });

      if (users.length === 0) {
        return res.status(404).json({ message: "No users found" });
      }

      res.status(200).json(users);
    } catch (error) {
      console.error("Error in search:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.get(
  "/:id",
  [param("id").notEmpty().withMessage("User ID is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const userId = req.params.id;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        omit: {
          password: true,
        },
      });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(200).json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.patch(
  "/:id",
  upload.fields([
    { name: "profilePicture", maxCount: 1 },
    { name: "coverPicture", maxCount: 1 },
  ]),
  [param("id").notEmpty().withMessage("Valid User ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.params.id;
      const currentUserId = req.user.userId;
      // Check if user is trying to update their own profile or is admin
      if (userId !== currentUserId && !req.user.isAdmin) {
        return res
          .status(403)
          .json({ message: "You can only update your own profile" });
      }

      const allowedFields = [
        "username",
        "name",
        "bio",
        "profilePicture",
        "coverPicture",
        "location",
        "studyField",
        "relationshipStatus",
        "relationships",
        "birthdate",
      ];
      const data = {};

      for (let key of allowedFields) {
        if (req.body[key] !== undefined) {
          data[key] = req.body[key];
        }
      }

      // Handle file uploads
      if (req.files) {
        if (req.files.profilePicture) {
          data.profilePicture = req.files.profilePicture[0].filename;
        }
        if (req.files.coverPicture) {
          data.coverPicture = req.files.coverPicture[0].filename;
        }
      }

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: data,
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          bio: true,
          profilePicture: true,
          coverPicture: true,
          updatedAt: true,
        },
      });

      res.status(200).json({
        message: "Profile updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(400).json({ message: "Username already exists" });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.get(
  "/:id/followers",
  [param("id").notEmpty().withMessage("User ID is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const userId = req.params.id;
      const followers = await prisma.follower.findMany({
        where: { followingId: userId },
      });

      res.status(200).json({ count: followers.length });
    } catch (error) {
      console.error("Error fetching followers:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);
router.get(
  "/:id/following",
  [param("id").notEmpty().withMessage("User ID is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const userId = req.params.id;
      const following = await prisma.follower.findMany({
        where: { followerId: userId },
      });

      res.status(200).json({ count: following.length });
    } catch (error) {
      console.error("Error fetching following:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.get(
  "/:id/friends",
  [param("id").notEmpty().withMessage("User ID is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const userId = req.params.id;
      const friends = await prisma.friendship.findMany({
        where: {
          userAId: userId,
          userBId: userId,
        },
      });

      res.status(200).json(friends);
    } catch (error) {
      console.error("Error fetching Friend:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

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
      .isIn(["active", "pending", "banned"])
      .withMessage("Status must be one of: active, pending, banned"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status;

      const users = await prisma.user.findMany({
        where: status ? { accountStatus: status } : {},
        skip: (page - 1) * limit,
        take: limit,
        omit: {
          password: true,
        },
        include: {
          _count: {
            select: {
              followers: true,
              following: true,
              posts: true,
            },
          },
        },
      });

      const totalUsers = await prisma.user.count();
      const totalPages = Math.ceil(totalUsers / limit);
      const pendingRequests = await prisma.user.count({
        where: {
          accountStatus: "pending",
        },
      });

      res.status(200).json({
        users,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
          pendingRequests,
        },
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.patch(
  "/editcover/:userId",
  upload.fields([{ name: "coverPicture", maxCount: 1 }]),
  [param("userId").isUUID().withMessage("Valid User ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.params.userId;
      const currentUserId = req.user.userId;

      // Check if user is trying to update their own profile or is admin
      if (userId !== currentUserId && !req.user.isAdmin) {
        return res
          .status(403)
          .json({ message: "You can only update your own profile" });
      }

      if (!req.files || !req.files.coverPicture) {
        return res.status(400).json({ message: "Cover image is required" });
      }

      const coverImage = req.files.coverPicture[0].filename;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { coverPicture: coverImage },
        select: {
          id: true,
          username: true,
          coverPicture: true,
          updatedAt: true,
        },
      });

      res.status(200).json({
        message: "Cover picture updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating cover image:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Update profile picture only
router.patch(
  "/editprofile/:userId",
  upload.fields([{ name: "profilePicture", maxCount: 1 }]),
  [param("userId").isUUID().withMessage("Valid User ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.params.userId;
      const currentUserId = req.user.userId;

      // Check if user is trying to update their own profile or is admin
      if (userId !== currentUserId && !req.user.isAdmin) {
        return res
          .status(403)
          .json({ message: "You can only update your own profile" });
      }

      if (!req.files || !req.files.profilePicture) {
        return res.status(400).json({ message: "Profile picture is required" });
      }

      const profileImage = req.files.profilePicture[0].filename;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { profilePicture: profileImage },
        select: {
          id: true,
          username: true,
          profilePicture: true,
          updatedAt: true,
        },
      });

      res.status(200).json({
        message: "Profile picture updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating profile picture:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.patch(
  "/:id/status",
  [
    body("status").notEmpty().withMessage("Status is required"),
    param("id").notEmpty().withMessage("Valid User ID is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.params.id;
      const { status } = req.body;

      if (!req.user.isAdmin) {
        return res
          .status(403)
          .json({ message: "Only admins can update user status" });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { accountStatus: status },
        select: {
          id: true,
          username: true,
          accountStatus: true,
          updatedAt: true,
        },
      });

      res.status(200).json({
        message: "User status updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

export { router as userRoute };
