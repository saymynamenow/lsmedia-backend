import express from "express";
import prisma from "../config/prismaConfig.js";
import { body, param, query, validationResult } from "express-validator";
import { authentication } from "../middleware/authenticantion.js";

const router = express.Router();

// Middleware to check if user is pro
const checkProUser = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.userId,
        deletedAt: null,
      },
      select: { isProUser: true },
    });

    if (!user || !user.isProUser) {
      return res.status(403).json({
        message: "Only Pro users can boost posts. Please upgrade your account.",
      });
    }

    next();
  } catch (error) {
    console.error("Error checking pro user status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Helper function to check weekly boost limit
const checkWeeklyBoostLimit = async (userId) => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const weeklyBoosts = await prisma.boostedPost.count({
    where: {
      post: {
        authorId: userId,
        deletedAt: null,
      },
      createdAt: {
        gte: oneWeekAgo,
      },
      deletedAt: null,
    },
  });

  return weeklyBoosts;
};

// Create a boosted post
router.post(
  "/",
  [
    body("postId").notEmpty().withMessage("Post ID is required"),
    body("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid ISO 8601 date"),
  ],
  authentication,
  checkProUser,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { postId, endDate } = req.body;
      const userId = req.user.userId;

      // Check if post exists and belongs to the user
      const post = await prisma.post.findUnique({
        where: {
          id: postId,
          deletedAt: null,
        },
        select: {
          id: true,
          authorId: true,
          pageId: true,
          type: true,
          content: true,
        },
      });

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Check if user owns the post (either as author or page owner)
      let canBoost = false;

      if (post.type === "user" && post.authorId === userId) {
        canBoost = true;
      } else if (post.type === "page" && post.pageId) {
        // Check if user is the owner of the page
        const page = await prisma.page.findUnique({
          where: {
            id: post.pageId,
            deletedAt: null,
          },
          select: { ownerId: true },
        });

        if (page && page.ownerId === userId) {
          canBoost = true;
        }
      }

      if (!canBoost) {
        return res.status(403).json({
          message:
            "You can only boost your own posts or posts from pages you own",
        });
      }

      // Check if post is already boosted and active
      const existingBoost = await prisma.boostedPost.findFirst({
        where: {
          postId: postId,
          status: "accepted",
          deletedAt: null,
          post: {
            deletedAt: null,
          },
          OR: [
            { endDate: null }, // No end date (indefinite)
            { endDate: { gt: new Date() } }, // End date is in the future
          ],
        },
      });

      if (existingBoost) {
        return res.status(400).json({
          message: "This post is already boosted",
        });
      }

      // Check weekly boost limit
      const weeklyBoosts = await checkWeeklyBoostLimit(userId);
      if (weeklyBoosts >= 3) {
        return res.status(429).json({
          message:
            "You have reached the weekly boost limit (3 boosts per week)",
          weeklyBoosts,
          nextReset: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      }

      // Create the boosted post
      const boostedPost = await prisma.boostedPost.create({
        data: {
          postId,
          endDate: endDate ? new Date(endDate) : null,
          status: "accepted",
        },
        include: {
          post: {
            include: {
              author: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  username: true,
                  name: true,
                  profilePicture: true,
                  isVerified: true,
                },
              },
              page: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  name: true,
                  profileImage: true,
                  isVerified: true,
                },
              },
              media: {
                where: { deletedAt: null },
              },
              _count: {
                select: {
                  comments: {
                    where: { deletedAt: null },
                  },
                  reactions: {
                    where: { deletedAt: null },
                  },
                },
              },
            },
          },
        },
      });

      res.status(201).json({
        message: "Post boosted successfully",
        boostedPost,
        remainingBoosts: 3 - (weeklyBoosts + 1),
      });
    } catch (error) {
      console.error("Error creating boosted post:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get all boosted posts (public endpoint for displaying boosted posts)
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [boostedPosts, total] = await Promise.all([
      prisma.boostedPost.findMany({
        where: {
          status: "accepted",
          deletedAt: null,
          post: {
            deletedAt: null,
          },
          //   OR: [{ endDate: null }, { endDate: { gt: new Date() } }], HERE
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          post: {
            include: {
              author: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  username: true,
                  name: true,
                  profilePicture: true,
                  isVerified: true,
                  isProUser: true,
                },
              },
              page: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  name: true,
                  profileImage: true,
                  isVerified: true,
                },
              },
              media: {
                where: { deletedAt: null },
              },
              reactions: {
                where: { deletedAt: null },
              },
              comments: {
                where: { deletedAt: null },
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      name: true,
                      profilePicture: true,
                      isVerified: true,
                    },
                  },
                },
              },
              _count: {
                select: {
                  comments: {
                    where: { deletedAt: null },
                  },
                  reactions: {
                    where: { deletedAt: null },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.boostedPost.count({
        where: {
          status: "accepted",
          deletedAt: null,
          post: {
            deletedAt: null,
          },
          OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
        },
      }),
    ]);

    const hasMore = skip + boostedPosts.length < total;

    res.status(200).json({
      boostedPosts,
      hasMore,
      total,
    });
  } catch (error) {
    console.error("Error fetching boosted posts:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Get user's boosted posts
router.get("/my-boosts", authentication, async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [boostedPosts, total] = await Promise.all([
      prisma.boostedPost.findMany({
        where: {
          deletedAt: null,
          post: {
            authorId: userId,
            deletedAt: null,
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          post: {
            include: {
              author: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  username: true,
                  name: true,
                  profilePicture: true,
                  isVerified: true,
                },
              },
              page: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  name: true,
                  profileImage: true,
                  isVerified: true,
                },
              },
              media: {
                where: { deletedAt: null },
              },
              _count: {
                select: {
                  comments: {
                    where: { deletedAt: null },
                  },
                  reactions: {
                    where: { deletedAt: null },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.boostedPost.count({
        where: {
          deletedAt: null,
          post: {
            authorId: userId,
            deletedAt: null,
          },
        },
      }),
    ]);

    // Get weekly boost count
    const weeklyBoosts = await checkWeeklyBoostLimit(userId);

    const hasMore = skip + boostedPosts.length < total;

    res.status(200).json({
      boostedPosts,
      hasMore,
      total,
      weeklyBoosts,
      remainingBoosts: Math.max(0, 3 - weeklyBoosts),
      nextReset: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  } catch (error) {
    console.error("Error fetching user's boosted posts:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Cancel/Stop a boosted post
router.delete(
  "/:id",
  [param("id").notEmpty().withMessage("Boosted post ID is required")],
  authentication,
  checkProUser,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const boostedPostId = req.params.id;
      const userId = req.user.userId;

      // Find the boosted post and check ownership
      const boostedPost = await prisma.boostedPost.findUnique({
        where: {
          id: boostedPostId,
          deletedAt: null,
        },
        include: {
          post: {
            select: {
              id: true,
              authorId: true,
              pageId: true,
              type: true,
              page: {
                where: { deletedAt: null },
                select: {
                  ownerId: true,
                },
              },
            },
          },
        },
      });

      if (!boostedPost) {
        return res.status(404).json({ message: "Boosted post not found" });
      }

      // Check if user owns the post
      let canCancel = false;

      if (
        boostedPost.post.type === "user" &&
        boostedPost.post.authorId === userId
      ) {
        canCancel = true;
      } else if (
        boostedPost.post.type === "page" &&
        boostedPost.post.page?.ownerId === userId
      ) {
        canCancel = true;
      }

      if (!canCancel) {
        return res.status(403).json({
          message: "You can only cancel your own boosted posts",
        });
      }

      // Update the boosted post to set end date to now (effectively canceling it)
      const updatedBoostedPost = await prisma.boostedPost.update({
        where: { id: boostedPostId },
        data: {
          endDate: new Date(),
          status: "rejected", // Mark as rejected to indicate it was canceled
        },
        include: {
          post: {
            select: {
              id: true,
              content: true,
              author: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  username: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      res.status(200).json({
        message: "Boosted post canceled successfully",
        boostedPost: updatedBoostedPost,
      });
    } catch (error) {
      console.error("Error canceling boosted post:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get boost statistics for a user
router.get("/stats", authentication, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Check if user is pro
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: { isProUser: true },
    });

    if (!user || !user.isProUser) {
      return res.status(403).json({
        message: "Only Pro users can access boost statistics",
      });
    }

    const [totalBoosts, activeBoosts, weeklyBoosts] = await Promise.all([
      prisma.boostedPost.count({
        where: {
          deletedAt: null,
          post: {
            authorId: userId,
            deletedAt: null,
          },
        },
      }),
      prisma.boostedPost.count({
        where: {
          deletedAt: null,
          post: {
            authorId: userId,
            deletedAt: null,
          },
          status: "accepted",
          OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
        },
      }),
      checkWeeklyBoostLimit(userId),
    ]);

    res.status(200).json({
      stats: {
        totalBoosts,
        activeBoosts,
        weeklyBoosts,
        remainingBoosts: Math.max(0, 3 - weeklyBoosts),
        maxBoostsPerWeek: 3,
        nextReset: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    console.error("Error fetching boost statistics:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export { router as boostedPostRouter };
