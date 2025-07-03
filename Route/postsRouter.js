import express from "express";
import prisma from "../config/prismaConfig.js";
import { param, query, validationResult } from "express-validator";
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { content, media } = req.body;
    const authorId = req.user.userId;
    if (!authorId) {
      return res.status(400).json({ message: "author ID are required" });
    }

    const data = {
      content,
      authorId: authorId,
    };
    if (media && media.length > 0) {
      data.media = {
        create: media.map((item) => ({
          url: item.url,
          type: item.type,
        })),
      };
    }

    const post = await prisma.post.create({
      data,
      include: {
        media: true,
      },
    });
    res.status(201).json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [post, total] = await Promise.all([
      prisma.post.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          media: true,
          author: {
            select: {
              id: true,
              username: true,
              name: true,
              profilePicture: true,
            },
          },
        },
      }),
      prisma.post.count(),
    ]);

    if (post.length === 0) {
      return res.status(404).json({ message: "No posts found" });
    }

    const hasMore = skip + post.length < total;

    res.status(200).json({ post, hasMore });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/timeline", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const userId = req.user.userId;
    const skip = (page - 1) * limit;

    // Get users that the current user is following
    const followingUsers = await prisma.follower.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    // Get pages that the current user is following
    const followingPages = await prisma.pageFollower.findMany({
      where: { userId: userId },
      select: { pageId: true },
    });

    const followingUserIds = followingUsers.map(
      (follower) => follower.followingId
    );
    followingUserIds.push(userId); // Include user's own posts

    const followingPageIds = followingPages.map(
      (pageFollower) => pageFollower.pageId
    );

    const [post, total] = await Promise.all([
      prisma.post.findMany({
        skip,
        take: limit,
        where: {
          OR: [
            // Posts from users (including own posts)
            {
              authorId: {
                in: followingUserIds,
              },
              type: "user",
            },
            // Posts from followed pages
            {
              pageId: {
                in: followingPageIds,
              },
              type: "page",
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: {
          media: true,
          // Include author info for user posts
          author: {
            select: {
              id: true,
              username: true,
              name: true,
              profilePicture: true,
              isVerified: true,
              isAdmin: true,
              isProUser: true,
            },
          },
          // Include page info for page posts
          page: {
            select: {
              id: true,
              name: true,
              profileImage: true,
              isVerified: true,
              category: true,
              coverImage: true,
            },
          },
          reactions: true,
          comments: {
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
              comments: true,
              reactions: true,
            },
          },
        },
      }),
      prisma.post.count({
        where: {
          OR: [
            // Count posts from users (including own posts)
            {
              authorId: {
                in: followingUserIds,
              },
              type: "user",
            },
            // Count posts from followed pages
            {
              pageId: {
                in: followingPageIds,
              },
              type: "page",
            },
          ],
        },
      }),
    ]);

    if (post.length === 0) {
      return res
        .status(404)
        .json({ message: "No posts found", hasMore: false });
    }

    const hasMore = skip + post.length < total;

    res.status(200).json({ post, hasMore });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get(
  "/:id",
  [param("id").notEmpty().withMessage("Post ID is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const postId = req.params.id;
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          media: true,
          author: {
            select: {
              id: true,
              username: true,
              name: true,
              profilePicture: true,
              isVerified: true,
            },
          },
          reactions: true,
          comments: {
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
        },
      });
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      res.status(200).json(post);
    } catch (error) {
      console.error("Error fetching post by ID:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.get(
  "/user/:userId",
  [
    param("userId").notEmpty().withMessage("User ID is required"),
    param("userId").isUUID().withMessage("Invalid User ID format"),
  ],
  async (req, res) => {
    try {
      const userId = req.params.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where: { authorId: userId },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            media: true,
            reactionss: true,
            comments: {
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
          },
        }),
      ]);
      if (posts.length === 0) {
        return res
          .status(404)
          .json({ message: "No posts found for this user" });
      }
      const hasMore = skip + posts.length < total;
      res.status(200).json({ posts, hasMore });
    } catch (error) {
      console.error("Error fetching user posts:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// router.patch("/:id", async (req, res) => {
//   try {
//     const postId = req.params.id;
//     const { content, media } = req.body;

//     const post = await prisma.post.update({
//       where: { id: postId },
//       data: {
//         content,
//         media: {
//           deleteMany: {},
//           create: media
//             ? media.map((item) => ({ url: item.url, type: item.type }))
//             : [],
//         },
//       },
//       include: {
//         media: true,
//       },
//     });

//     res.status(200).json(post);
//   } catch (error) {
//     console.error("Error updating post:", error);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// });

router.delete(
  "/:id",
  [param("id").notEmpty().withMessage("Post ID is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const postId = req.params.id;
      const post = await prisma.post.delete({
        where: { id: postId },
      });
      res.status(200).json({ message: "Post deleted successfully", post });
    } catch (error) {
      if (error.code === "P2025") {
        return res.status(404).json({ message: "Post not found" });
      }
      console.error("Error deleting post:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.get(
  "/user/username/:username",
  [
    param("username").notEmpty().withMessage("Username is required"),
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

      const username = req.params.username;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // First, find the user to get their info
      const user = await prisma.user.findUnique({
        where: { username: username },
        select: {
          id: true,
          username: true,
          name: true,
          bio: true,
          profilePicture: true,
          createdAt: true,
          isVerified: true,
          _count: {
            select: {
              posts: true,
              followers: true,
              following: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Then, get their posts with pagination
      const [posts, totalPosts] = await Promise.all([
        prisma.post.findMany({
          where: { author: { username: username } },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            content: true,
            createdAt: true,
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
              select: {
                id: true,
                url: true,
                type: true,
              },
            },
            reactions: true,
            comments: {
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
                comments: true,
                reactions: true,
              },
            },
          },
        }),
        prisma.post.count({
          where: { author: { username: username } },
        }),
      ]);

      const hasMore = skip + posts.length < totalPosts;

      return res.status(200).json({
        posts,
        hasMore,
        totalPosts,
      });
    } catch (error) {
      console.error("Error fetching user posts by username:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get timeline statistics
router.get("/timeline/stats", async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get users that the current user is following
    const followingUsers = await prisma.follower.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    // Get pages that the current user is following
    const followingPages = await prisma.pageFollower.findMany({
      where: { userId: userId },
      select: { pageId: true },
    });

    const followingUserIds = followingUsers.map(
      (follower) => follower.followingId
    );
    followingUserIds.push(userId); // Include user's own posts

    const followingPageIds = followingPages.map(
      (pageFollower) => pageFollower.pageId
    );

    // Get counts for different post types
    const [userPostsCount, pagePostsCount, totalPosts] = await Promise.all([
      prisma.post.count({
        where: {
          authorId: {
            in: followingUserIds,
          },
          type: "user",
        },
      }),
      prisma.post.count({
        where: {
          pageId: {
            in: followingPageIds,
          },
          type: "page",
        },
      }),
      prisma.post.count({
        where: {
          OR: [
            {
              authorId: {
                in: followingUserIds,
              },
              type: "user",
            },
            {
              pageId: {
                in: followingPageIds,
              },
              type: "page",
            },
          ],
        },
      }),
    ]);

    res.status(200).json({
      stats: {
        totalPosts,
        userPosts: userPostsCount,
        pagePosts: pagePostsCount,
        followingUsers: followingUsers.length,
        followingPages: followingPages.length,
      },
    });
  } catch (error) {
    console.error("Error fetching timeline stats:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export { router as postsRouter };
