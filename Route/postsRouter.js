import express from "express";
import prisma from "../config/prismaConfig.js";
import { param, query, validationResult } from "express-validator";
import { authentication } from "../middleware/authenticantion.js";
import { uploadPostMedia } from "../config/multer.js";
import { SoftDeleteService } from "../services/softDeleteService.js";
const router = express.Router();

router.post(
  "/",
  authentication,
  uploadPostMedia.array("media", 10),
  async (req, res) => {
    try {
      const { content, pageId, type } = req.body;
      const authorId = req.user.userId;
      const uploadedFiles = req.files;

      if (!authorId) {
        return res
          .status(400)
          .json({ message: "User authentication required" });
      }

      // Validate post type
      const postType = type || "user";
      if (!["user", "page"].includes(postType)) {
        return res
          .status(400)
          .json({ message: "Invalid post type. Must be 'user' or 'page'" });
      }

      // Validate that there's either content or media
      if (!content && (!uploadedFiles || uploadedFiles.length === 0)) {
        return res.status(400).json({
          message: "Post must have either content or media",
        });
      }

      // If it's a page post, validate that pageId is provided and user has permission
      if (postType === "page") {
        if (!pageId) {
          return res
            .status(400)
            .json({ message: "pageId is required for page posts" });
        }

        // Check if user has permission to post on this page (owner, admin, or moderator)
        const pageMember = await prisma.pageMember.findFirst({
          where: {
            deletedAt: null,
            userId: authorId,
            pageId: pageId,
            status: "accepted",
            role: {
              in: ["owner", "admin", "moderator"],
            },
          },
        });

        if (!pageMember) {
          return res.status(403).json({
            message: "You don't have permission to post on this page",
          });
        }
      }

      const data = {
        content,
        type: postType,
      };

      // Set author or page based on post type
      if (postType === "page") {
        data.pageId = pageId;
        data.authorId = authorId; // Keep track of who created the page post
      } else {
        data.authorId = authorId;
      }

      // Handle uploaded media files
      if (uploadedFiles && uploadedFiles.length > 0) {
        data.media = {
          create: uploadedFiles.map((file) => {
            // Determine media type based on MIME type
            let mediaType = "image";
            if (file.mimetype.startsWith("video/")) {
              mediaType = "video";
            }

            return {
              url: `/post_media/${file.filename}`,
              type: mediaType,
            };
          }),
        };
      }

      const post = await prisma.post.create({
        data,
        include: {
          media: true,
          author: {
            select: {
              id: true,
              username: true,
              name: true,
              profilePicture: true,
              isVerified: true,
              createdAt: true,
            },
          },
          page: {
            select: {
              id: true,
              name: true,
              description: true,
              profileImage: true,
              isVerified: true,
            },
          },
        },
      });

      res.status(201).json({
        message: "Post created successfully",
        post,
        mediaCount: uploadedFiles ? uploadedFiles.length : 0,
      });
    } catch (error) {
      console.error("Error creating post:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [post, total] = await Promise.all([
      prisma.post.findMany({
        where: {
          deletedAt: null,
          author: {
            deletedAt: null,
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          media: {
            where: {
              deletedAt: null,
            },
          },
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
      prisma.post.count({
        where: {
          deletedAt: null,
          author: {
            deletedAt: null,
          },
        },
      }),
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

router.get("/timeline", authentication, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const userId = req.user.userId;
    const skip = (page - 1) * limit;

    // Get users that the current user is following
    const followingUsers = await prisma.follower.findMany({
      where: { followerId: userId, deletedAt: null },
      select: { followingId: true },
    });

    // Get pages that the current user is following
    const followingPages = await prisma.pageFollower.findMany({
      where: { userId: userId, deletedAt: null },
      select: { pageId: true },
    });
    // Get pages where the current user is an accepted member
    const memberPages = await prisma.pageMember.findMany({
      where: {
        deletedAt: null,
        userId: userId,
        status: "accepted",
      },
      select: { pageId: true },
    });

    const followingUserIds = followingUsers.map(
      (follower) => follower.followingId
    );
    followingUserIds.push(userId);

    // Combine followed pages and member pages (remove duplicates)
    const followingPageIds = followingPages.map(
      (pageFollower) => pageFollower.pageId
    );
    const memberPageIds = memberPages.map((member) => member.pageId);

    // Create a unique array of page IDs
    const allPageIds = [...new Set([...followingPageIds, ...memberPageIds])];

    const [post, total] = await Promise.all([
      prisma.post.findMany({
        skip,
        take: limit,
        where: {
          deletedAt: null,
          OR: [
            {
              authorId: {
                in: followingUserIds,
              },
              type: "user",
            },
            {
              pageId: {
                in: allPageIds,
              },
              type: "page",
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: {
          media: {
            where: {
              deletedAt: null,
            },
          },
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
          page: {
            where: {
              deletedAt: null,
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
          comments: {
            where: {
              deletedAt: null,
              user: {
                deletedAt: null,
              },
            },
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
      }),
      prisma.post.count({
        where: {
          deletedAt: null,
          OR: [
            // Count posts from users (including own posts)
            {
              authorId: {
                in: followingUserIds,
              },
              type: "user",
            },
            // Count posts from followed pages and member pages
            {
              pageId: {
                in: allPageIds,
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
        where: { id: postId, deletedAt: null },
        include: {
          media: {
            where: {
              deletedAt: null,
            },
          },
          author: {
            select: {
              id: true,
              username: true,
              name: true,
              profilePicture: true,
              isVerified: true,
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
          comments: {
            where: {
              deletedAt: null,
              user: {
                deletedAt: null,
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
          where: { authorId: userId, deletedAt: null },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            media: {
              where: {
                deletedAt: null,
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
            comments: {
              where: {
                deletedAt: null,
                user: {
                  deletedAt: null,
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
          },
        }),
        prisma.post.count({
          where: {
            authorId: userId,
            deletedAt: null,
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
      const postDetail = await prisma.post.findUnique({
        where: { id: postId, deletedAt: null },
        select: {
          authorId: true,
        },
      });
      const author = req.user;
      if (!postDetail) {
        return res.status(404).json({ message: "Post not found" });
      }
      if (postDetail.authorId !== author.userId && !author.isAdmin) {
        return res
          .status(403)
          .json({ message: "You do not have permission to delete this post" });
      }
      const post = await SoftDeleteService.softDeletePost(postId);
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
        where: { username: username, deletedAt: null },
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
          where: {
            author: {
              username: username,
              deletedAt: null,
            },
            deletedAt: null,
          },
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
            page: {
              select: {
                id: true,
                name: true,
                profileImage: true,
                isVerified: true,
              },
            },
            media: {
              where: {
                deletedAt: null,
              },
              select: {
                id: true,
                url: true,
                type: true,
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
            comments: {
              where: {
                deletedAt: null,
                user: {
                  deletedAt: null,
                },
              },
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
        }),
        prisma.post.count({
          where: {
            author: {
              username: username,
              deletedAt: null,
            },
            deletedAt: null,
          },
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
router.get("/timeline/stats", authentication, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get users that the current user is following
    const followingUsers = await prisma.follower.findMany({
      where: {
        followerId: userId,
        deletedAt: null,
        following: {
          deletedAt: null,
        },
      },
      select: { followingId: true },
    });

    // Get pages that the current user is following
    const followingPages = await prisma.pageFollower.findMany({
      where: {
        userId: userId,
        deletedAt: null,
        page: {
          deletedAt: null,
        },
      },
      select: { pageId: true },
    });

    // Get pages where the current user is an accepted member
    const memberPages = await prisma.pageMember.findMany({
      where: {
        deletedAt: null,
        userId: userId,
        status: "accepted",
        page: {
          deletedAt: null,
        },
      },
      select: { pageId: true },
    });

    const followingUserIds = followingUsers.map(
      (follower) => follower.followingId
    );
    followingUserIds.push(userId); // Include user's own posts

    // Combine followed pages and member pages (remove duplicates)
    const followingPageIds = followingPages.map(
      (pageFollower) => pageFollower.pageId
    );
    const memberPageIds = memberPages.map((member) => member.pageId);

    // Create a unique array of page IDs
    const allPageIds = [...new Set([...followingPageIds, ...memberPageIds])];

    // Get counts for different post types
    const [userPostsCount, pagePostsCount, totalPosts] = await Promise.all([
      prisma.post.count({
        where: {
          deletedAt: null,
          authorId: {
            in: followingUserIds,
          },
          type: "user",
        },
      }),
      prisma.post.count({
        where: {
          deletedAt: null,
          pageId: {
            in: allPageIds,
          },
          type: "page",
        },
      }),
      prisma.post.count({
        where: {
          deletedAt: null,
          OR: [
            {
              authorId: {
                in: followingUserIds,
              },
              type: "user",
            },
            {
              pageId: {
                in: allPageIds,
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

// Dedicated endpoint for creating page posts
router.post(
  "/page/:pageId",
  authentication,
  uploadPostMedia.array("media", 10),
  async (req, res) => {
    try {
      const { content } = req.body;
      const { pageId } = req.params;
      const authorId = req.user.userId;
      const uploadedFiles = req.files;

      if (!authorId) {
        return res
          .status(400)
          .json({ message: "User authentication required" });
      }

      if (!pageId) {
        return res.status(400).json({ message: "pageId is required" });
      }

      // Validate that there's either content or media
      if (!content && (!uploadedFiles || uploadedFiles.length === 0)) {
        return res.status(400).json({
          message: "Post must have either content or media",
        });
      }

      // Check if user has permission to post on this page (owner, admin, or moderator)
      const pageMember = await prisma.pageMember.findFirst({
        where: {
          deletedAt: null,
          userId: authorId,
          pageId: pageId,
          status: "accepted",
          role: {
            in: ["owner", "admin", "moderator"],
          },
        },
      });

      if (!pageMember) {
        return res
          .status(403)
          .json({ message: "You don't have permission to post on this page" });
      }

      const data = {
        content,
        pageId: pageId,
        authorId: authorId, // Keep track of who created the page post
        type: "page",
      };

      // Handle uploaded media files
      if (uploadedFiles && uploadedFiles.length > 0) {
        data.media = {
          create: uploadedFiles.map((file) => {
            // Determine media type based on MIME type
            let mediaType = "image";
            if (file.mimetype.startsWith("video/")) {
              mediaType = "video";
            }

            return {
              url: `/uploads/post_media/${file.filename}`,
              type: mediaType,
            };
          }),
        };
      }

      const post = await prisma.post.create({
        data,
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
          page: {
            select: {
              id: true,
              name: true,
              description: true,
              profileImage: true,
              isVerified: true,
            },
          },
        },
      });

      res.status(201).json({
        message: "Page post created successfully",
        post,
        mediaCount: uploadedFiles ? uploadedFiles.length : 0,
      });
    } catch (error) {
      console.error("Error creating page post:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Debug endpoint to check all posts and their types
router.get("/debug/all-posts", authentication, async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      where: {
        deletedAt: null,
        author: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
        content: true,
        authorId: true,
        pageId: true,
        type: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        page: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const summary = {
      total: posts.length,
      byType: {
        user: posts.filter((p) => p.type === "user").length,
        page: posts.filter((p) => p.type === "page").length,
      },
      withPageId: posts.filter((p) => p.pageId).length,
      withAuthorId: posts.filter((p) => p.authorId).length,
      pagePostsWithoutType: posts.filter((p) => p.pageId && p.type === "user")
        .length,
    };

    res.json({
      summary,
      posts: posts.slice(0, 20), // Show first 20 posts
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Debug endpoint to fix existing page posts type
router.post("/debug/fix-page-posts", authentication, async (req, res) => {
  try {
    // Update all posts that have pageId but type is still "user"
    const result = await prisma.post.updateMany({
      where: {
        deletedAt: null,
        pageId: {
          not: null,
        },
        type: "user", // Find posts that have pageId but type is still "user"
      },
      data: {
        type: "page",
      },
    });

    res.json({
      message: "Fixed page posts type",
      updatedCount: result.count,
    });
  } catch (error) {
    console.error("Error fixing page posts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Enhanced timeline with boosted posts
router.get("/timeline-enhanced", authentication, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const userId = req.user.userId;
    const skip = (page - 1) * limit;

    // Get users that the current user is following
    const followingUsers = await prisma.follower.findMany({
      where: { followerId: userId, deletedAt: null },
      select: { followingId: true },
    });

    // Get pages that the current user is following
    const followingPages = await prisma.pageFollower.findMany({
      where: { userId: userId, deletedAt: null },
      select: { pageId: true },
    });

    // Get pages where the current user is an accepted member
    const memberPages = await prisma.pageMember.findMany({
      where: {
        deletedAt: null,
        userId: userId,
        status: "accepted",
      },
      select: { pageId: true },
    });

    const followingUserIds = followingUsers.map(
      (follower) => follower.followingId
    );
    followingUserIds.push(userId);

    // Combine followed pages and member pages (remove duplicates)
    const followingPageIds = followingPages.map(
      (pageFollower) => pageFollower.pageId
    );
    const memberPageIds = memberPages.map((member) => member.pageId);
    const allPageIds = [...new Set([...followingPageIds, ...memberPageIds])];

    // Get boosted posts (with higher priority)
    const boostedPosts = await prisma.post.findMany({
      where: {
        deletedAt: null,
        boostedPosts: {
          some: {
            deletedAt: null,
            status: "accepted",
            OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
          },
        },
        OR: [
          {
            authorId: {
              in: followingUserIds,
            },
            type: "user",
          },
          {
            pageId: {
              in: allPageIds,
            },
            type: "page",
          },
        ],
      },
      include: {
        media: {
          where: {
            deletedAt: null,
          },
        },
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
        page: {
          where: {
            deletedAt: null,
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
        comments: {
          where: {
            deletedAt: null,
            user: {
              deletedAt: null,
            },
          },
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
        boostedPosts: {
          where: {
            deletedAt: null,
            status: "accepted",
            OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
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
      take: Math.min(5, limit), // Limit boosted posts
    });

    // Get regular posts
    const regularPosts = await prisma.post.findMany({
      skip,
      take: limit - boostedPosts.length,
      where: {
        deletedAt: null,
        NOT: {
          id: {
            in: boostedPosts.map((p) => p.id),
          },
        },
        OR: [
          {
            authorId: {
              in: followingUserIds,
            },
            type: "user",
          },
          {
            pageId: {
              in: allPageIds,
            },
            type: "page",
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        media: {
          where: {
            deletedAt: null,
          },
        },
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
        page: {
          where: {
            deletedAt: null,
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
        comments: {
          where: {
            deletedAt: null,
            user: {
              deletedAt: null,
            },
          },
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
        boostedPosts: {
          where: {
            deletedAt: null,
            status: "accepted",
            OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
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
    });

    // Combine and sort posts (boosted posts first, then regular posts)
    const allPosts = [
      ...boostedPosts.map((post) => ({ ...post, isBoosted: true })),
      ...regularPosts.map((post) => ({ ...post, isBoosted: false })),
    ];

    // Get total count
    const total = await prisma.post.count({
      where: {
        deletedAt: null,
        OR: [
          {
            authorId: {
              in: followingUserIds,
            },
            type: "user",
          },
          {
            pageId: {
              in: allPageIds,
            },
            type: "page",
          },
        ],
      },
    });

    const hasMore = skip + allPosts.length < total;

    res.status(200).json({
      posts: allPosts,
      hasMore,
      total,
      boostedCount: boostedPosts.length,
      regularCount: regularPosts.length,
    });
  } catch (error) {
    console.error("Error fetching enhanced timeline:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Upload media files separately (for rich text editors or pre-upload)
router.post(
  "/upload-media",
  authentication,
  uploadPostMedia.array("media", 10),
  async (req, res) => {
    try {
      const uploadedFiles = req.files;

      if (!uploadedFiles || uploadedFiles.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const mediaFiles = uploadedFiles.map((file) => {
        // Determine media type based on MIME type
        let mediaType = "image";
        if (file.mimetype.startsWith("video/")) {
          mediaType = "video";
        }

        return {
          filename: file.filename,
          originalName: file.originalname,
          url: `/uploads/post_media/${file.filename}`,
          type: mediaType,
          size: file.size,
          mimeType: file.mimetype,
        };
      });

      res.status(200).json({
        message: "Media uploaded successfully",
        files: mediaFiles,
        count: mediaFiles.length,
      });
    } catch (error) {
      console.error("Error uploading media:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

export { router as postsRouter };
