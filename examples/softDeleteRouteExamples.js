/**
 * Example Route Updates for Soft Delete System
 *
 * This file shows how to update existing routes to properly handle soft deleted records.
 * Copy these patterns to your existing route files.
 */

import express from "express";
import { param, query, body, validationResult } from "express-validator";
import prisma from "../config/prismaConfig.js";
import { authentication } from "../middleware/authenticantion.js";
import { SoftDeleteService } from "../services/softDeleteService.js";

const router = express.Router();

// =============================================================================
// USER ROUTES WITH SOFT DELETE
// =============================================================================

/**
 * Get all users (excluding soft deleted)
 */
router.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null, // Exclude soft deleted users
      },
      select: {
        id: true,
        username: true,
        name: true,
        profilePicture: true,
        isVerified: true,
        createdAt: true,
      },
    });

    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get user by ID (excluding soft deleted)
 */
router.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        id,
        deletedAt: null, // Exclude soft deleted users
      },
      select: {
        id: true,
        username: true,
        name: true,
        bio: true,
        profilePicture: true,
        coverPicture: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: {
            posts: {
              where: { deletedAt: null }, // Count only non-deleted posts
            },
            followers: {
              where: { deletedAt: null }, // Count only non-deleted followers
            },
            following: {
              where: { deletedAt: null }, // Count only non-deleted following
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Soft delete user (admin only)
 */
router.delete("/users/:id", authentication, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.userId;

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { isAdmin: true },
    });

    if (!currentUser?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Check if user exists and is not already deleted
    const user = await prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Soft delete user using service
    await SoftDeleteService.softDeleteUser(id);

    res.json({ message: "User soft deleted successfully" });
  } catch (error) {
    console.error("Error soft deleting user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// =============================================================================
// POST ROUTES WITH SOFT DELETE
// =============================================================================

/**
 * Get all posts (excluding soft deleted posts and from soft deleted users)
 */
router.get("/posts", async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      where: {
        deletedAt: null, // Exclude soft deleted posts
        author: {
          deletedAt: null, // Exclude posts from soft deleted users
        },
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true,
            profilePicture: true,
            isVerified: true,
          },
        },
        media: {
          where: {
            deletedAt: null, // Exclude soft deleted media
          },
        },
        comments: {
          where: {
            deletedAt: null, // Exclude soft deleted comments
            user: {
              deletedAt: null, // Exclude comments from soft deleted users
            },
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                profilePicture: true,
              },
            },
          },
        },
        reactions: {
          where: {
            deletedAt: null, // Exclude soft deleted reactions
            user: {
              deletedAt: null, // Exclude reactions from soft deleted users
            },
          },
        },
        _count: {
          select: {
            comments: {
              where: {
                deletedAt: null,
                user: {
                  deletedAt: null,
                },
              },
            },
            reactions: {
              where: {
                deletedAt: null,
                user: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Soft delete post
 */
router.delete("/posts/:id", authentication, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Check if post exists and user owns it
    const post = await prisma.post.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { authorId: userId },
          { author: { isAdmin: true } }, // Allow admin to delete any post
        ],
      },
    });

    if (!post) {
      return res
        .status(404)
        .json({ message: "Post not found or unauthorized" });
    }

    // Soft delete post using service
    await SoftDeleteService.softDeletePost(id);

    res.json({ message: "Post soft deleted successfully" });
  } catch (error) {
    console.error("Error soft deleting post:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// =============================================================================
// PAGE ROUTES WITH SOFT DELETE
// =============================================================================

/**
 * Get all pages (excluding soft deleted)
 */
router.get("/pages", async (req, res) => {
  try {
    const pages = await prisma.page.findMany({
      where: {
        deletedAt: null, // Exclude soft deleted pages
        owner: {
          deletedAt: null, // Exclude pages from soft deleted users
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            name: true,
            profilePicture: true,
            isVerified: true,
          },
        },
        _count: {
          select: {
            members: {
              where: {
                deletedAt: null,
                user: {
                  deletedAt: null,
                },
              },
            },
            followers: {
              where: {
                deletedAt: null,
                user: {
                  deletedAt: null,
                },
              },
            },
            posts: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(pages);
  } catch (error) {
    console.error("Error fetching pages:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// =============================================================================
// ADMIN ROUTES FOR SOFT DELETE MANAGEMENT
// =============================================================================

/**
 * Get soft deleted records (admin only)
 */
router.get("/admin/soft-deleted/:model", authentication, async (req, res) => {
  try {
    const { model } = req.params;
    const userId = req.user.userId;

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const records = await SoftDeleteService.getSoftDeletedRecords(model);
    res.json(records);
  } catch (error) {
    console.error("Error fetching soft deleted records:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Restore soft deleted record (admin only)
 */
router.patch("/admin/restore/:model/:id", authentication, async (req, res) => {
  try {
    const { model, id } = req.params;
    const userId = req.user.userId;

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Get the appropriate restore method
    const methodName = `restore${
      model.charAt(0).toUpperCase() + model.slice(1)
    }`;

    if (!SoftDeleteService[methodName]) {
      return res.status(400).json({ message: "Invalid model" });
    }

    const restored = await SoftDeleteService[methodName](id);
    res.json({ message: "Record restored successfully", data: restored });
  } catch (error) {
    console.error("Error restoring record:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get soft delete statistics (admin only)
 */
router.get("/admin/soft-delete-stats", authentication, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const stats = await SoftDeleteService.getSoftDeleteStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching soft delete statistics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Permanently delete old soft deleted records (admin only)
 */
router.delete("/admin/cleanup/:model", authentication, async (req, res) => {
  try {
    const { model } = req.params;
    const { days = 30 } = req.query;
    const userId = req.user.userId;

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const result = await SoftDeleteService.permanentlyDeleteOldRecords(
      model,
      parseInt(days)
    );
    res.json({
      message: `Permanently deleted ${result.count} old ${model} records`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error("Error cleaning up old records:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Helper function to build where clause with soft delete exclusion
 */
const buildSoftDeleteWhereClause = (
  baseWhere = {},
  includeSoftDeleted = false
) => {
  if (includeSoftDeleted) {
    return baseWhere;
  }

  return {
    ...baseWhere,
    deletedAt: null,
  };
};

/**
 * Helper function to build include clause with soft delete exclusion
 */
const buildSoftDeleteIncludeClause = (baseInclude = {}) => {
  const processInclude = (includeObj) => {
    if (typeof includeObj === "boolean") {
      return includeObj;
    }

    if (typeof includeObj === "object" && includeObj !== null) {
      const result = { ...includeObj };

      // Add deletedAt: null to where clause if it exists
      if (result.where) {
        result.where = {
          ...result.where,
          deletedAt: null,
        };
      } else {
        result.where = { deletedAt: null };
      }

      // Recursively process nested includes
      if (result.include) {
        result.include = processInclude(result.include);
      }

      return result;
    }

    return includeObj;
  };

  return processInclude(baseInclude);
};

export default router;
