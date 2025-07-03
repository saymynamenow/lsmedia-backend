import express from "express";
import { query, validationResult } from "express-validator";
import prisma from "../config/prismaConfig.js";
import { authentication } from "../middleware/authenticantion.js";

const router = express.Router();

// Universal search endpoint (users, pages, posts)
router.get(
  "/",
  [
    query("q")
      .notEmpty()
      .isLength({ min: 1, max: 100 })
      .withMessage("Search query must be between 1 and 100 characters"),
    query("type")
      .optional()
      .isIn(["all", "users", "pages", "posts"])
      .withMessage("Type must be one of: all, users, pages, posts"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage("Limit must be between 1 and 20"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { q, type = "all" } = req.query;
      const limit = parseInt(req.query.limit) || 10;
      const currentUserId = req.user.userId;

      const searchQuery = `%${q}%`;
      const results = {
        query: q,
        users: [],
        pages: [],
        posts: [],
        total: 0,
      };

      // Search Users
      if (type === "all" || type === "users") {
        const users = await prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: q } },
              { username: { contains: q } },
              { bio: { contains: q } },
            ],
            accountStatus: "active",
          },
          select: {
            id: true,
            name: true,
            username: true,
            bio: true,
            profilePicture: true,
            isVerified: true,
            isProUser: true,
            _count: {
              select: {
                followers: true,
                posts: true,
              },
            },
          },
          take: limit,
          orderBy: [
            { isVerified: "desc" },
            { isProUser: "desc" },
            { name: "asc" },
          ],
        });

        // Check friendship/follow status with current user
        const userIds = users.map((user) => user.id);
        const [friendships, followships] = await Promise.all([
          prisma.friendship.findMany({
            where: {
              OR: [
                { userAId: currentUserId, userBId: { in: userIds } },
                { userBId: currentUserId, userAId: { in: userIds } },
              ],
            },
          }),
          prisma.follower.findMany({
            where: {
              followerId: currentUserId,
              followingId: { in: userIds },
            },
          }),
        ]);

        const friendshipMap = friendships.reduce((acc, friendship) => {
          const friendId =
            friendship.userAId === currentUserId
              ? friendship.userBId
              : friendship.userAId;
          acc[friendId] = friendship.status;
          return acc;
        }, {});

        const followshipMap = followships.reduce((acc, follow) => {
          acc[follow.followingId] = true;
          return acc;
        }, {});

        results.users = users.map((user) => ({
          ...user,
          type: "user",
          userRelation: {
            isFriend: friendshipMap[user.id] === "accepted",
            friendshipStatus: friendshipMap[user.id] || null,
            isFollowing: !!followshipMap[user.id],
            isSelf: user.id === currentUserId,
          },
          matchType: user.name.toLowerCase().includes(q.toLowerCase())
            ? "name"
            : user.username.toLowerCase().includes(q.toLowerCase())
            ? "username"
            : "bio",
        }));
      }

      // Search Pages
      if (type === "all" || type === "pages") {
        const pages = await prisma.page.findMany({
          where: {
            OR: [
              { name: { contains: q } },
              { description: { contains: q } },
              { category: { contains: q } },
            ],
            isPublic: true,
          },
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            profileImage: true,
            isVerified: true,
            ownerId: true,
            owner: {
              select: {
                id: true,
                name: true,
                username: true,
                profilePicture: true,
                isVerified: true,
              },
            },
            _count: {
              select: {
                followers: true,
                members: true,
                posts: true,
              },
            },
          },
          take: limit,
          orderBy: [{ isVerified: "desc" }, { name: "asc" }],
        });

        // Check user relationship with pages
        const pageIds = pages.map((page) => page.id);
        const [memberships, followerships] = await Promise.all([
          prisma.pageMember.findMany({
            where: {
              userId: currentUserId,
              pageId: { in: pageIds },
            },
            select: { pageId: true, role: true },
          }),
          prisma.pageFollower.findMany({
            where: {
              userId: currentUserId,
              pageId: { in: pageIds },
            },
            select: { pageId: true },
          }),
        ]);

        const membershipMap = memberships.reduce((acc, m) => {
          acc[m.pageId] = m.role;
          return acc;
        }, {});

        const pageFollowshipMap = followerships.reduce((acc, f) => {
          acc[f.pageId] = true;
          return acc;
        }, {});

        results.pages = pages.map((page) => ({
          ...page,
          type: "page",
          userRelation: {
            isMember: !!membershipMap[page.id],
            isFollowing: !!pageFollowshipMap[page.id],
            memberRole: membershipMap[page.id] || null,
            isOwner: page.ownerId === currentUserId,
          },
          matchType: page.name.toLowerCase().includes(q.toLowerCase())
            ? "name"
            : page.description?.toLowerCase().includes(q.toLowerCase())
            ? "description"
            : "category",
        }));
      }

      // Search Posts
      if (type === "all" || type === "posts") {
        const posts = await prisma.post.findMany({
          where: {
            content: { contains: q },
          },
          select: {
            id: true,
            content: true,
            type: true,
            createdAt: true,
            authorId: true,
            pageId: true,
            author: {
              select: {
                id: true,
                name: true,
                username: true,
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
              select: {
                id: true,
                url: true,
                type: true,
              },
              take: 1,
            },
            _count: {
              select: {
                comments: true,
                reactions: true,
              },
            },
          },
          take: limit,
          orderBy: [{ createdAt: "desc" }],
        });

        results.posts = posts.map((post) => ({
          ...post,
          type: "post",
          matchType: "content",
          contentPreview:
            post.content.length > 100
              ? post.content.substring(0, 100) + "..."
              : post.content,
        }));
      }

      // Calculate total results
      results.total =
        results.users.length + results.pages.length + results.posts.length;

      return res.status(200).json(results);
    } catch (error) {
      console.error("Error in universal search:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Search suggestions for autocomplete
router.get(
  "/suggestions",
  [
    query("q")
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage("Query must be between 1 and 50 characters"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage("Limit must be between 1 and 10"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { q } = req.query;
      const limit = parseInt(req.query.limit) || 5;

      if (!q || q.trim() === "") {
        return res.status(200).json({
          suggestions: [],
          query: "",
          type: "empty",
        });
      }

      const suggestions = [];

      // Get top users
      const users = await prisma.user.findMany({
        where: {
          OR: [{ name: { contains: q } }, { username: { contains: q } }],
          accountStatus: "active",
        },
        select: {
          id: true,
          name: true,
          username: true,
          profilePicture: true,
          isVerified: true,
        },
        take: Math.ceil(limit / 3),
        orderBy: [{ isVerified: "desc" }, { name: "asc" }],
      });

      // Get top pages
      const pages = await prisma.page.findMany({
        where: {
          OR: [{ name: { contains: q } }, { category: { contains: q } }],
          isPublic: true,
        },
        select: {
          id: true,
          name: true,
          category: true,
          profileImage: true,
          isVerified: true,
        },
        take: Math.ceil(limit / 3),
        orderBy: [{ isVerified: "desc" }, { name: "asc" }],
      });

      // Format suggestions
      users.forEach((user) => {
        suggestions.push({
          id: user.id,
          title: user.name,
          subtitle: `@${user.username}`,
          image: user.profilePicture,
          isVerified: user.isVerified,
          type: "user",
        });
      });

      pages.forEach((page) => {
        suggestions.push({
          id: page.id,
          title: page.name,
          subtitle: page.category || "Page",
          image: page.profileImage,
          isVerified: page.isVerified,
          type: "page",
        });
      });

      // Sort by verification status and limit results
      const sortedSuggestions = suggestions
        .sort((a, b) => {
          if (a.isVerified !== b.isVerified) {
            return b.isVerified ? 1 : -1;
          }
          return a.title.localeCompare(b.title);
        })
        .slice(0, limit);

      return res.status(200).json({
        suggestions: sortedSuggestions,
        query: q,
        type: "suggestions",
      });
    } catch (error) {
      console.error("Error fetching search suggestions:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Search users only
router.get(
  "/users",
  [
    query("q")
      .notEmpty()
      .isLength({ min: 1, max: 100 })
      .withMessage("Search query must be between 1 and 100 characters"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { q } = req.query;
      const limit = parseInt(req.query.limit) || 20;
      const page = parseInt(req.query.page) || 1;
      const skip = (page - 1) * limit;
      const currentUserId = req.user.userId;

      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: q } },
              { username: { contains: q } },
              { bio: { contains: q } },
            ],
            accountStatus: "active",
          },
          select: {
            id: true,
            name: true,
            username: true,
            bio: true,
            profilePicture: true,
            coverPicture: true,
            isVerified: true,
            isProUser: true,
            location: true,
            _count: {
              select: {
                followers: true,
                following: true,
                posts: true,
                friends: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: [
            { isVerified: "desc" },
            { isProUser: "desc" },
            { name: "asc" },
          ],
        }),
        prisma.user.count({
          where: {
            OR: [
              { name: { contains: q } },
              { username: { contains: q } },
              { bio: { contains: q } },
            ],
            accountStatus: "active",
          },
        }),
      ]);

      // Check relationships with current user
      const userIds = users.map((user) => user.id);
      const [friendships, followships] = await Promise.all([
        prisma.friendship.findMany({
          where: {
            OR: [
              { userAId: currentUserId, userBId: { in: userIds } },
              { userBId: currentUserId, userAId: { in: userIds } },
            ],
          },
        }),
        prisma.follower.findMany({
          where: {
            followerId: currentUserId,
            followingId: { in: userIds },
          },
        }),
      ]);

      const friendshipMap = friendships.reduce((acc, friendship) => {
        const friendId =
          friendship.userAId === currentUserId
            ? friendship.userBId
            : friendship.userAId;
        acc[friendId] = friendship.status;
        return acc;
      }, {});

      const followshipMap = followships.reduce((acc, follow) => {
        acc[follow.followingId] = true;
        return acc;
      }, {});

      const usersWithRelations = users.map((user) => ({
        ...user,
        userRelation: {
          isFriend: friendshipMap[user.id] === "accepted",
          friendshipStatus: friendshipMap[user.id] || null,
          isFollowing: !!followshipMap[user.id],
          isSelf: user.id === currentUserId,
        },
        matchType: user.name.toLowerCase().includes(q.toLowerCase())
          ? "name"
          : user.username.toLowerCase().includes(q.toLowerCase())
          ? "username"
          : "bio",
      }));

      return res.status(200).json({
        users: usersWithRelations,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasMore: skip + users.length < totalCount,
        },
        query: q,
      });
    } catch (error) {
      console.error("Error searching users:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Search pages only
router.get(
  "/pages",
  [
    query("q")
      .notEmpty()
      .isLength({ min: 1, max: 100 })
      .withMessage("Search query must be between 1 and 100 characters"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("category")
      .optional()
      .isString()
      .withMessage("Category must be a string"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { q, category } = req.query;
      const limit = parseInt(req.query.limit) || 20;
      const page = parseInt(req.query.page) || 1;
      const skip = (page - 1) * limit;
      const currentUserId = req.user.userId;

      // Build search conditions
      const searchConditions = {
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
          { category: { contains: q } },
        ],
        isPublic: true,
      };

      if (category) {
        searchConditions.category = { contains: category };
      }

      const [pages, totalCount] = await Promise.all([
        prisma.page.findMany({
          where: searchConditions,
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
                members: true,
                followers: true,
                posts: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: [{ isVerified: "desc" }, { name: "asc" }],
        }),
        prisma.page.count({ where: searchConditions }),
      ]);

      // Check user relationships with pages
      const pageIds = pages.map((page) => page.id);
      const [memberships, followerships] = await Promise.all([
        prisma.pageMember.findMany({
          where: {
            userId: currentUserId,
            pageId: { in: pageIds },
          },
          select: { pageId: true, role: true },
        }),
        prisma.pageFollower.findMany({
          where: {
            userId: currentUserId,
            pageId: { in: pageIds },
          },
          select: { pageId: true },
        }),
      ]);

      const membershipMap = memberships.reduce((acc, m) => {
        acc[m.pageId] = m.role;
        return acc;
      }, {});

      const followshipMap = followerships.reduce((acc, f) => {
        acc[f.pageId] = true;
        return acc;
      }, {});

      const pagesWithRelations = pages.map((page) => ({
        ...page,
        userRelation: {
          isMember: !!membershipMap[page.id],
          isFollowing: !!followshipMap[page.id],
          memberRole: membershipMap[page.id] || null,
          isOwner: page.ownerId === currentUserId,
        },
        matchType: page.name.toLowerCase().includes(q.toLowerCase())
          ? "name"
          : page.description?.toLowerCase().includes(q.toLowerCase())
          ? "description"
          : "category",
      }));

      return res.status(200).json({
        pages: pagesWithRelations,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasMore: skip + pages.length < totalCount,
        },
        query: q,
        filters: {
          category: category || null,
        },
      });
    } catch (error) {
      console.error("Error searching pages:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Search posts only
router.get(
  "/posts",
  [
    query("q")
      .notEmpty()
      .isLength({ min: 1, max: 100 })
      .withMessage("Search query must be between 1 and 100 characters"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("type")
      .optional()
      .isIn(["user", "page"])
      .withMessage("Type must be either 'user' or 'page'"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { q, type } = req.query;
      const limit = parseInt(req.query.limit) || 20;
      const page = parseInt(req.query.page) || 1;
      const skip = (page - 1) * limit;

      // Build search conditions
      const searchConditions = {
        content: { contains: q },
      };

      if (type) {
        searchConditions.type = type;
      }

      const [posts, totalCount] = await Promise.all([
        prisma.post.findMany({
          where: searchConditions,
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true,
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
              select: {
                id: true,
                url: true,
                type: true,
              },
            },
            _count: {
              select: {
                comments: true,
                reactions: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: [{ createdAt: "desc" }],
        }),
        prisma.post.count({ where: searchConditions }),
      ]);

      const postsWithPreview = posts.map((post) => ({
        ...post,
        contentPreview:
          post.content.length > 150
            ? post.content.substring(0, 150) + "..."
            : post.content,
      }));

      return res.status(200).json({
        posts: postsWithPreview,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasMore: skip + posts.length < totalCount,
        },
        query: q,
        filters: {
          type: type || null,
        },
      });
    } catch (error) {
      console.error("Error searching posts:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

export { router as searchRouter };
