import express from "express";
import prisma from "../config/prismaConfig.js";
import { query, param, validationResult } from "express-validator";
const router = express.Router();

router.get(
  "/users/search",
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
  "/users/:id",
  [param("id").isUUID().withMessage("User ID is required")],
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
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          profilePicture: true,
          bio: true,
          createdAt: true,
          updatedAt: true,
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

router.patch("/users/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const allowedFields = ["username", "name", "bio", "profilePicture"];
    const data = {};

    for (let key of allowedFields) {
      if (req.body[key] !== undefined) {
        data[key] = req.body[key];
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
        updatedAt: true,
      },
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get(
  "/users/:id/followers",
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
  "/users/:id/following",
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
  "/users/:id/friends",
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
  "/users/",
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const users = await prisma.user.findMany({
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

      res.status(200).json({
        users,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
        },
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

export { router as userRoute };
