import express from "express";
import { body, query, param, validationResult, check } from "express-validator";
import prisma from "../config/prismaConfig.js";
import { authentication } from "../middleware/authenticantion.js";
import { upload, uploadPostMedia } from "../config/multer.js";
import { NotificationService } from "../services/notificationService.js";

const router = express.Router();

router.get(
  "/suggestions",
  [
    query("q")
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage("Query must be between 1 and 50 characters"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage("Limit must be between 1 and 20"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { q } = req.query;
      const limit = parseInt(req.query.limit) || 10;

      if (!q || q.trim() === "") {
        const popularPages = await prisma.page.findMany({
          where: {
            isPublic: true,
            isVerified: true,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            category: true,
            profileImage: true,
            isVerified: true,
            _count: {
              select: {
                followers: {
                  where: { deletedAt: null },
                },
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: limit,
        });

        return res.status(200).json({
          suggestions: popularPages.map((page) => ({
            id: page.id,
            name: page.name,
            category: page.category,
            profileImage: page.profileImage,
            isVerified: page.isVerified,
            type: "page",
            followerCount: page._count.followers,
          })),
          query: "",
          type: "popular",
        });
      }

      // Search for pages matching the query
      const suggestions = await prisma.page.findMany({
        where: {
          OR: [{ name: { contains: q } }, { category: { contains: q } }],
          isPublic: true,
          isVerified: true,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          category: true,
          profileImage: true,
          isVerified: true,
          _count: {
            select: {
              followers: {
                where: { deletedAt: null },
              },
            },
          },
        },
        orderBy: [{ name: "asc" }],
        take: limit,
      });

      return res.status(200).json({
        suggestions: suggestions.map((page) => ({
          id: page.id,
          name: page.name,
          category: page.category,
          profileImage: page.profileImage,
          isVerified: page.isVerified,
          type: "page",
          followerCount: page._count.followers,
        })),
        query: q,
        type: "search",
      });
    } catch (error) {
      console.error("Error fetching page suggestions:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.get(
  "/my-pending-requests",
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
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      // Get user's pending requests
      const [pendingRequests, totalCount] = await Promise.all([
        prisma.pageMember.findMany({
          where: {
            userId,
            status: "pending",
          },
          include: {
            page: {
              select: {
                id: true,
                name: true,
                profileImage: true,
                isVerified: true,
                category: true,
                owner: {
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
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.pageMember.count({
          where: {
            userId,
            status: "pending",
          },
        }),
      ]);

      return res.status(200).json({
        pendingRequests,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasMore: skip + pendingRequests.length < totalCount,
        },
      });
    } catch (error) {
      console.error("Error fetching user's pending requests:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);
router.get("/followed", async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get followed pages
    const followedPages = await prisma.pageFollower.findMany({
      where: { userId },
      include: {
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
      },
    });

    return res.status(200).json({
      followedPages,
    });
  } catch (error) {
    console.error("Error fetching followed pages:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});
router.get(
  "/getpages",
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("search")
      .optional()
      .isString()
      .withMessage("Search must be a string"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const search = req.query.search?.trim();

      const where = search
        ? {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } },
              { category: { contains: search } },
            ],
          }
        : {};

      const [pages, totalPages] = await Promise.all([
        prisma.page.findMany({
          where,
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
          orderBy: [{ isVerified: "desc" }, { createdAt: "desc" }],
          skip,
          take: limit,
        }),
        prisma.page.count({ where }),
      ]);

      return res.status(200).json({
        pages,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalPages / limit),
          totalPagesCount: totalPages,
          hasMore: skip + pages.length < totalPages,
        },
      });
    } catch (error) {
      console.error("Error fetching pages:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);
// Create a new page
// Backend: Process and store images
router.post(
  "/create",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  [
    body("name")
      .notEmpty()
      .withMessage("Page name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Page name must be between 2 and 100 characters")
      .trim(),
    body("description")
      .optional()
      .isLength({ max: 1000 })
      .withMessage("Description must not exceed 1000 characters")
      .trim(),
    body("category")
      .optional()
      .isLength({ max: 50 })
      .withMessage("Category must not exceed 50 characters")
      .trim(),
    body("isPublic")
      .optional()
      .custom((value) => {
        if (
          value === "true" ||
          value === "false" ||
          typeof value === "boolean"
        ) {
          return true;
        }
        throw new Error("isPublic must be 'true' or 'false'");
      }),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, category, isPublic } = req.body;
      const ownerId = req.user.userId;

      // Check if user already owns a page with the same name
      const existingPage = await prisma.page.findFirst({
        where: {
          name: { equals: name.trim() },
          ownerId,
        },
      });

      if (existingPage) {
        return res.status(400).json({
          message: "You already have a page with this name",
        });
      }

      // Get uploaded files
      const profileImage = req.files?.profileImage?.[0];
      const coverImage = req.files?.coverImage?.[0];

      // Prepare page data
      const pageData = {
        name: name.trim(),
        description: description?.trim() || null,
        category: category?.trim() || null,
        isPublic: isPublic === "true" || isPublic === true,
        ownerId,
      };

      // Process and save image paths
      if (profileImage) {
        pageData.profileImage = profileImage.filename;
      }

      if (coverImage) {
        pageData.coverImage = coverImage.filename;
      }

      // Use transaction to create page and add owner as follower atomically
      const result = await prisma.$transaction(async (tx) => {
        // Create the page
        const newPage = await tx.page.create({
          data: pageData,
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                name: true,
                profilePicture: true,
              },
            },
          },
        });

        // Add owner as a follower (only once)
        await tx.pageFollower.create({
          data: {
            userId: ownerId,
            pageId: newPage.id,
          },
        });

        // Add owner as a member with owner role
        await tx.pageMember.create({
          data: {
            userId: ownerId,
            pageId: newPage.id,
            role: "owner",
            status: "accepted",
          },
        });

        return newPage;
      });

      // Get the updated page with counts
      const newPage = await prisma.page.findUnique({
        where: { id: result.id },
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              name: true,
              profilePicture: true,
            },
          },
          _count: {
            select: {
              members: {
                where: {
                  status: "accepted",
                },
              },
              followers: true,
              posts: true,
            },
          },
        },
      });

      return res.status(201).json({
        message: "Page created successfully",
        page: newPage,
      });
    } catch (error) {
      console.error("Error creating page:", error);

      // Handle specific database errors
      if (error.code === "P2002") {
        if (error.meta?.target?.includes("name")) {
          return res.status(400).json({
            message: "A page with this name already exists",
          });
        }
        return res.status(400).json({
          message: "Page creation failed due to duplicate data",
        });
      }

      if (error.code === "P2025") {
        return res.status(404).json({
          message: "User not found",
        });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get page details
router.get(
  "/:pageId",
  [param("pageId").notEmpty().withMessage("Page ID is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { pageId } = req.params;
      const currentUserId = req.user?.userId;

      const page = await prisma.page.findUnique({
        where: { id: pageId },
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
          members: {
            where: {
              status: "accepted", // Only show accepted members
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
            orderBy: [
              { role: "desc" }, // Show owners/admins/moderators first
              { createdAt: "desc" },
            ],
            take: 10,
          },
          _count: {
            select: {
              members: {
                where: {
                  status: "accepted", // Only count accepted members
                },
              },
              followers: true,
              posts: true,
            },
          },
        },
      });

      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Check if current user is member/follower
      let userRelation = null;
      if (currentUserId) {
        const [membership, followership] = await Promise.all([
          prisma.pageMember.findUnique({
            where: {
              userId_pageId: {
                userId: currentUserId,
                pageId: pageId,
              },
            },
          }),
          prisma.pageFollower.findUnique({
            where: {
              userId_pageId: {
                userId: currentUserId,
                pageId: pageId,
              },
            },
          }),
        ]);

        userRelation = {
          isMember: membership?.status === "accepted",
          isFollower: !!followership,
          memberRole: membership?.role || null,
          membershipStatus: membership?.status || null,
          hasPendingRequest: membership?.status === "pending",
          isOwner: page.ownerId === currentUserId,
        };
      }

      return res.status(200).json({
        page: {
          ...page,
          userRelation,
        },
      });
    } catch (error) {
      console.error("Error fetching page:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Follow a page
router.post(
  "/:pageId/follow",
  [param("pageId").notEmpty().withMessage("Page ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { pageId } = req.params;
      const userId = req.user.userId;

      // Check if page exists
      const page = await prisma.page.findUnique({
        where: { id: pageId },
        select: { id: true, name: true, ownerId: true },
      });

      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Check if user is the owner
      if (page.ownerId === userId) {
        return res.status(400).json({ message: "Cannot follow your own page" });
      }

      // Check if already following
      const existingFollow = await prisma.pageFollower.findUnique({
        where: {
          userId_pageId: {
            userId,
            pageId,
          },
        },
      });

      if (existingFollow) {
        return res.status(400).json({ message: "Already following this page" });
      }

      // Create follow relationship
      const follow = await prisma.pageFollower.create({
        data: {
          userId,
          pageId,
        },
      });

      // Create notification for page follow
      await NotificationService.createPageFollowNotification(userId, pageId);

      return res.status(201).json({
        message: `You are now following ${page.name}`,
        follow,
      });
    } catch (error) {
      console.error("Error following page:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Unfollow a page
router.delete(
  "/:pageId/unfollow",
  [param("pageId").notEmpty().withMessage("Page ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { pageId } = req.params;
      const userId = req.user.userId;

      // Check if following
      const existingFollow = await prisma.pageFollower.findUnique({
        where: {
          userId_pageId: {
            userId,
            pageId,
          },
        },
      });

      if (!existingFollow) {
        return res.status(404).json({ message: "Not following this page" });
      }

      // Remove follow relationship
      await prisma.pageFollower.delete({
        where: {
          userId_pageId: {
            userId,
            pageId,
          },
        },
      });

      return res.status(200).json({
        message: "Successfully unfollowed page",
      });
    } catch (error) {
      console.error("Error unfollowing page:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Join page as member (creates pending request)
router.post(
  "/:pageId/join",
  [param("pageId").notEmpty().withMessage("Page ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { pageId } = req.params;
      const userId = req.user.userId;

      // Check if page exists
      const page = await prisma.page.findUnique({
        where: { id: pageId },
        select: { id: true, name: true, isPublic: true, ownerId: true },
      });

      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Check if user is the owner
      if (page.ownerId === userId) {
        return res
          .status(400)
          .json({ message: "You are the owner of this page" });
      }

      // Check if already has a membership request or is already a member
      const existingMember = await prisma.pageMember.findUnique({
        where: {
          userId_pageId: {
            userId,
            pageId,
          },
        },
      });

      if (existingMember) {
        if (existingMember.status === "pending") {
          return res.status(400).json({
            message: "You already have a pending join request for this page",
          });
        } else if (existingMember.status === "accepted") {
          return res.status(400).json({
            message: "You are already a member of this page",
          });
        }
      }

      // Create pending membership request (status defaults to "pending" in schema)
      const membership = await prisma.pageMember.create({
        data: {
          userId,
          pageId,
          role: "member",
          status: "pending",
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
          page: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Send notification to page owner about the join request
      try {
        await NotificationService.createNotification({
          userId: page.ownerId,
          senderId: userId,
          type: "page_follow",
          title: "New Join Request",
          content: `${membership.user.name} requested to join your page "${page.name}"`,
          pageId: pageId,
        });
      } catch (notificationError) {
        console.error("Error sending notification:", notificationError);
        // Don't fail the request if notification fails
      }

      return res.status(201).json({
        message: `Join request sent for ${page.name}. Waiting for approval.`,
        membership: {
          ...membership,
          status: "pending",
        },
      });
    } catch (error) {
      console.error("Error joining page:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Leave page
router.delete(
  "/:pageId/leave",
  [param("pageId").notEmpty().withMessage("Page ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { pageId } = req.params;
      const userId = req.user.userId;

      // Check if page exists
      const page = await prisma.page.findUnique({
        where: { id: pageId },
        select: { id: true, ownerId: true },
      });

      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Check if user is the owner
      if (page.ownerId === userId) {
        return res.status(400).json({ message: "Owner cannot leave the page" });
      }

      // Check if member and has accepted status
      const existingMember = await prisma.pageMember.findUnique({
        where: {
          userId_pageId: {
            userId,
            pageId,
          },
        },
      });

      if (!existingMember) {
        return res.status(404).json({ message: "Not a member of this page" });
      }

      if (existingMember.status === "pending") {
        return res.status(400).json({
          message:
            "Cannot leave page - your membership is still pending approval",
        });
      }

      if (existingMember.status !== "accepted") {
        return res
          .status(400)
          .json({ message: "Cannot leave page - invalid membership status" });
      }

      // Remove membership
      await prisma.pageMember.delete({
        where: {
          userId_pageId: {
            userId,
            pageId,
          },
        },
      });

      return res.status(200).json({
        message: "Successfully left the page",
      });
    } catch (error) {
      console.error("Error leaving page:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get pending join requests for a page (admin/moderator/owner only)
router.get(
  "/:pageId/pending-requests",
  [
    param("pageId").notEmpty().withMessage("Page ID is required"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { pageId } = req.params;
      const userId = req.user.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      // Check if page exists and user has permission to manage it
      const pageData = await prisma.page.findUnique({
        where: { id: pageId },
        select: {
          id: true,
          name: true,
          ownerId: true,
          members: {
            where: {
              userId: userId,
              status: "accepted",
              role: { in: ["admin", "moderator", "owner"] },
            },
            select: { role: true },
          },
        },
      });

      if (!pageData) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Check if user is owner or has admin/moderator role
      const isOwner = pageData.ownerId === userId;
      const hasPermission = isOwner || pageData.members.length > 0;

      if (!hasPermission) {
        return res.status(403).json({
          message:
            "You don't have permission to view pending requests for this page",
        });
      }

      // Get pending requests
      const [pendingRequests, totalCount] = await Promise.all([
        prisma.pageMember.findMany({
          where: {
            pageId,
            status: "pending",
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
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.pageMember.count({
          where: {
            pageId,
            status: "pending",
          },
        }),
      ]);

      return res.status(200).json({
        pendingRequests,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasMore: skip + pendingRequests.length < totalCount,
        },
      });
    } catch (error) {
      console.error("Error fetching pending requests:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Approve a join request (admin/moderator/owner only)
router.patch(
  "/:pageId/approve-request/:userId",
  [
    param("pageId").notEmpty().withMessage("Page ID is required"),
    param("userId").notEmpty().withMessage("User ID is required"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { pageId, userId: targetUserId } = req.params;
      const userId = req.user.userId;

      // Check if page exists and user has permission to manage it
      const pageData = await prisma.page.findUnique({
        where: { id: pageId },
        select: {
          id: true,
          name: true,
          ownerId: true,
          members: {
            where: {
              userId: userId,
              status: "accepted",
              role: { in: ["admin", "moderator", "owner"] },
            },
            select: { role: true },
          },
        },
      });

      if (!pageData) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Check if user is owner or has admin/moderator role
      const isOwner = pageData.ownerId === userId;
      const hasPermission = isOwner || pageData.members.length > 0;

      if (!hasPermission) {
        return res.status(403).json({
          message:
            "You don't have permission to approve requests for this page",
        });
      }

      // Find the pending request
      const pendingRequest = await prisma.pageMember.findUnique({
        where: {
          userId_pageId: {
            userId: targetUserId,
            pageId,
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
      });

      if (!pendingRequest) {
        return res.status(404).json({ message: "Join request not found" });
      }

      if (pendingRequest.status !== "pending") {
        return res.status(400).json({
          message: `Request is already ${pendingRequest.status}`,
        });
      }

      // Approve the request
      const approvedMember = await prisma.pageMember.update({
        where: {
          userId_pageId: {
            userId: targetUserId,
            pageId,
          },
        },
        data: {
          status: "accepted",
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
      });

      // Send notification to the user about approval
      try {
        await NotificationService.createNotification({
          userId: targetUserId,
          senderId: userId,
          type: "page_follow",
          title: "Join Request Approved",
          content: `Your request to join "${pageData.name}" has been approved`,
          pageId: pageId,
        });
      } catch (notificationError) {
        console.error("Error sending notification:", notificationError);
        // Don't fail the request if notification fails
      }

      return res.status(200).json({
        message: `${pendingRequest.user.name} has been approved to join the page`,
        member: approvedMember,
      });
    } catch (error) {
      console.error("Error approving join request:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Reject a join request (admin/moderator/owner only)
router.patch(
  "/:pageId/reject-request/:userId",
  [
    param("pageId").notEmpty().withMessage("Page ID is required"),
    param("userId").notEmpty().withMessage("User ID is required"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { pageId, userId: targetUserId } = req.params;
      const userId = req.user.userId;

      // Check if page exists and user has permission to manage it
      const pageData = await prisma.page.findUnique({
        where: { id: pageId },
        select: {
          id: true,
          name: true,
          ownerId: true,
          members: {
            where: {
              userId: userId,
              status: "accepted",
              role: { in: ["admin", "moderator", "owner"] },
            },
            select: { role: true },
          },
        },
      });

      if (!pageData) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Check if user is owner or has admin/moderator role
      const isOwner = pageData.ownerId === userId;
      const hasPermission = isOwner || pageData.members.length > 0;

      if (!hasPermission) {
        return res.status(403).json({
          message: "You don't have permission to reject requests for this page",
        });
      }

      // Find the pending request
      const pendingRequest = await prisma.pageMember.findUnique({
        where: {
          userId_pageId: {
            userId: targetUserId,
            pageId,
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
      });

      if (!pendingRequest) {
        return res.status(404).json({ message: "Join request not found" });
      }

      if (pendingRequest.status !== "pending") {
        return res.status(400).json({
          message: `Request is already ${pendingRequest.status}`,
        });
      }

      // Reject the request (delete it or update status to rejected)
      await prisma.pageMember.delete({
        where: {
          userId_pageId: {
            userId: targetUserId,
            pageId,
          },
        },
      });

      // Send notification to the user about rejection
      try {
        await NotificationService.createNotification({
          userId: targetUserId,
          senderId: userId,
          type: "page_follow",
          title: "Join Request Rejected",
          content: `Your request to join "${pageData.name}" has been rejected`,
          pageId: pageId,
        });
      } catch (notificationError) {
        console.error("Error sending notification:", notificationError);
        // Don't fail the request if notification fails
      }

      return res.status(200).json({
        message: `${pendingRequest.user.name}'s join request has been rejected`,
      });
    } catch (error) {
      console.error("Error rejecting join request:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Create post in page
router.post(
  "/:pageId/post",
  [
    param("pageId").notEmpty().withMessage("Page ID is required"),
    body("content").optional().trim(),
  ],
  uploadPostMedia.array("media", 10),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { pageId } = req.params;
      const { content } = req.body;
      const userId = req.user.userId;
      const uploadedFiles = req.files;

      // Validate that at least content or media is provided
      if (!content && (!uploadedFiles || uploadedFiles.length === 0)) {
        return res.status(400).json({
          message: "Post must have either content or media",
        });
      }

      // Check if user is member or owner of the page
      const [page, membership] = await Promise.all([
        prisma.page.findUnique({
          where: { id: pageId },
          select: { id: true, name: true, ownerId: true },
        }),
        prisma.pageMember.findUnique({
          where: {
            userId_pageId: {
              userId,
              pageId,
            },
          },
        }),
      ]);

      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Check if user can post (owner or accepted member)
      const canPost =
        page.ownerId === userId ||
        (membership && membership.status === "accepted");
      if (!canPost) {
        return res.status(403).json({
          message: "You must be an accepted member to post in this page",
        });
      }

      // Create post with media
      const post = await prisma.post.create({
        data: {
          content: content || "",
          pageId,
          type: "page",
          authorId: userId,
          // Handle uploaded media files
          ...(uploadedFiles && uploadedFiles.length > 0
            ? {
                media: {
                  create: uploadedFiles.map((file) => ({
                    type: file.mimetype.startsWith("image/")
                      ? "image"
                      : "video",
                    url: `/post_media/${file.filename}`,
                  })),
                },
              }
            : {}),
        },
        include: {
          page: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
          author: {
            omit: {
              password: true,
              email: true,
            },
          },
          media: true,
          _count: {
            select: {
              comments: true,
              reactions: true,
            },
          },
        },
      });

      return res.status(201).json({
        message: "Post created successfully",
        post,
        mediaCount: uploadedFiles ? uploadedFiles.length : 0,
      });
    } catch (error) {
      console.error("Error creating page posts:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.delete(
  "/:pageId",
  [param("pageId").notEmpty().withMessage("Page ID is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { pageId } = req.params;
      const userId = req.user.userId;

      // Check if page exists
      const page = await prisma.page.findUnique({
        where: { id: pageId },
        select: { id: true, ownerId: true },
      });

      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Check if user is the owner
      if (page.ownerId !== userId) {
        return res
          .status(403)
          .json({ message: "You are not the owner of this page" });
      }

      // Delete page
      await prisma.page.delete({
        where: { id: pageId },
      });

      return res.status(200).json({ message: "Page deleted successfully" });
    } catch (error) {
      console.error("Error deleting page:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.patch(
  "/:pageId",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { pageId } = req.params;
      const { name, description, category, email, address, phone, website } =
        req.body;
      const userId = req.user.userId;

      // Check if page exists
      const page = await prisma.page.findUnique({
        where: { id: pageId },
        select: { id: true, ownerId: true },
      });

      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Prepare update data
      const updateData = {
        name,
        description: description || null,
        category: category || null,
        email: email || null,
        website: website || null,
        address: address || null,
        phone: phone || null,
        updatedAt: new Date(),
      };

      // Process uploaded images
      const profileImage = req.files?.profileImage?.[0];
      const coverImage = req.files?.coverImage?.[0];

      if (profileImage) {
        updateData.profileImage = `${profileImage.filename}`;
      }
      if (coverImage) {
        updateData.coverImage = `${coverImage.filename}`;
      }

      // Update page
      const updatedPage = await prisma.page.update({
        where: { id: pageId },
        data: updateData,
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              name: true,
              profilePicture: true,
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
      });

      return res.status(200).json({
        message: "Page updated successfully",
        page: updatedPage,
      });
    } catch (error) {
      console.log("Error updating page:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get page posts
router.get(
  "/:pageId/posts",
  [
    param("pageId").notEmpty().withMessage("Page ID is required"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { pageId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      // Check if page exists
      const pageExists = await prisma.page.findUnique({
        where: { id: pageId },
        select: { id: true, name: true },
      });

      if (!pageExists) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Get posts
      const posts = await prisma.post.findMany({
        where: {
          pageId: pageId,
          type: "page",
        },
        include: {
          page: {
            select: {
              id: true,
              name: true,
              profileImage: true,
              isVerified: true,
            },
          },
          author: {
            omit: {
              password: true,
              email: true,
            },
          },
          media: true,
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
            orderBy: { createdAt: "desc" },
          },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
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

        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      });

      // Get total count
      const totalPosts = await prisma.post.count({
        where: {
          pageId: pageId,
          type: "page",
        },
      });

      return res.status(200).json({
        posts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalPosts / limit),
          totalPosts,
          hasMore: skip + posts.length < totalPosts,
        },
      });
    } catch (error) {
      console.error("Error fetching page posts:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get page followers
router.get(
  "/:pageId/followers",
  [
    param("pageId").notEmpty().withMessage("Page ID is required"),
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

      const { pageId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      // Check if page exists
      const pageExists = await prisma.page.findUnique({
        where: { id: pageId },
        select: { id: true, name: true },
      });

      if (!pageExists) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Get followers
      const followers = await prisma.pageFollower.findMany({
        where: { pageId },
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
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      });

      // Get total count
      const totalFollowers = await prisma.pageFollower.count({
        where: { pageId },
      });

      return res.status(200).json({
        followers: followers.map((f) => ({
          ...f.user,
          followedAt: f.createdAt,
        })),
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalFollowers / limit),
          totalFollowers,
          hasMore: skip + followers.length < totalFollowers,
        },
      });
    } catch (error) {
      console.error("Error fetching page followers:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get page members
router.get(
  "/:pageId/members",
  [
    param("pageId").notEmpty().withMessage("Page ID is required"),
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

      const { pageId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      // Check if page exists
      const pageExists = await prisma.page.findUnique({
        where: { id: pageId },
        select: { id: true, name: true },
      });

      if (!pageExists) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Get members (only accepted by default)
      const members = await prisma.pageMember.findMany({
        where: {
          pageId,
          status: "accepted",
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
        orderBy: [
          { role: "desc" }, // Show owners/admins/moderators first
          { createdAt: "desc" },
        ],
        skip,
        take: limit,
      });

      // Get total count of accepted members
      const totalMembers = await prisma.pageMember.count({
        where: {
          pageId,
          status: "accepted",
        },
      });

      return res.status(200).json({
        members: members.map((m) => ({
          ...m.user,
          role: m.role,
          status: m.status,
          joinedAt: m.createdAt,
        })),
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalMembers / limit),
          totalMembers,
          hasMore: skip + members.length < totalMembers,
        },
      });
    } catch (error) {
      console.error("Error fetching page members:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get trending/popular pages
router.get(
  "/trending",
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
    query("timeframe")
      .optional()
      .isIn(["day", "week", "month", "all"])
      .withMessage("Timeframe must be one of: day, week, month, all"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const currentUserId = req.user.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const timeframe = req.query.timeframe || "week";
      const skip = (page - 1) * limit;

      // Calculate date for timeframe
      let dateFilter = {};
      if (timeframe !== "all") {
        const now = new Date();
        const daysBack =
          timeframe === "day" ? 1 : timeframe === "week" ? 7 : 30;
        const cutoffDate = new Date(
          now.getTime() - daysBack * 24 * 60 * 60 * 1000
        );
        dateFilter = { gte: cutoffDate };
      }

      // Get pages ordered by activity (followers + posts + members)
      const pages = await prisma.page.findMany({
        where: {
          isPublic: true,
          ...(timeframe !== "all" && { createdAt: dateFilter }),
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
              members: true,
              followers: true,
              posts: true,
            },
          },
        },
        orderBy: [{ isVerified: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      });

      // Sort by activity score (followers * 2 + members * 3 + posts)
      const pagesWithScore = pages
        .map((page) => ({
          ...page,
          activityScore:
            page._count.followers * 2 +
            page._count.members * 3 +
            page._count.posts,
        }))
        .sort((a, b) => b.activityScore - a.activityScore);

      // Check user relationships
      const pageIds = pagesWithScore.map((page) => page.id);
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

      const followershipMap = followerships.reduce((acc, f) => {
        acc[f.pageId] = true;
        return acc;
      }, {});

      const pagesWithRelations = pagesWithScore.map((page) => ({
        ...page,
        userRelation: {
          isMember: !!membershipMap[page.id],
          isFollower: !!followershipMap[page.id],
          memberRole: membershipMap[page.id] || null,
          isOwner: page.ownerId === currentUserId,
        },
      }));

      const totalCount = await prisma.page.count({
        where: {
          isPublic: true,
          ...(timeframe !== "all" && { createdAt: dateFilter }),
        },
      });

      return res.status(200).json({
        pages: pagesWithRelations,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasMore: skip + pages.length < totalCount,
        },
        timeframe,
      });
    } catch (error) {
      console.error("Error fetching trending pages:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get pages by category
router.get(
  "/category/:categoryName",
  [
    param("categoryName").notEmpty().withMessage("Category name is required"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { categoryName } = req.params;
      const currentUserId = req.user.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const [pages, totalCount] = await Promise.all([
        prisma.page.findMany({
          where: {
            category: { contains: categoryName },
            isPublic: true,
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
                members: true,
                followers: true,
                posts: true,
              },
            },
          },
          orderBy: [{ isVerified: "desc" }, { createdAt: "desc" }],
          skip,
          take: limit,
        }),
        prisma.page.count({
          where: {
            category: { contains: categoryName, lte: "insensitive" },
            isPublic: true,
          },
        }),
      ]);

      // Check user relationships
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

      const followershipMap = followerships.reduce((acc, f) => {
        acc[f.pageId] = true;
        return acc;
      }, {});

      const pagesWithRelations = pages.map((page) => ({
        ...page,
        userRelation: {
          isMember: !!membershipMap[page.id],
          isFollower: !!followershipMap[page.id],
          memberRole: membershipMap[page.id] || null,
          isOwner: page.ownerId === currentUserId,
        },
      }));

      return res.status(200).json({
        pages: pagesWithRelations,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasMore: skip + pages.length < totalCount,
        },
        category: categoryName,
      });
    } catch (error) {
      console.error("Error fetching pages by category:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get available categories
router.get("/categories", async (req, res) => {
  try {
    const categories = await prisma.page.findMany({
      where: {
        category: { not: null },
        isPublic: true,
      },
      select: {
        category: true,
      },
      distinct: ["category"],
    });

    const categoryList = categories
      .map((page) => page.category)
      .filter((category) => category && category.trim() !== "")
      .sort();

    return res.status(200).json({
      categories: categoryList,
      count: categoryList.length,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Get search suggestions (autocomplete)

// Search pages by name (optimized for search bar)

// Get user's own pending join requests

// Upload media files for page posts (for rich text editors or pre-upload)
router.post(
  "/:pageId/upload-media",
  authentication,
  uploadPostMedia.array("media", 10),
  async (req, res) => {
    try {
      const { pageId } = req.params;
      const userId = req.user.userId;
      const uploadedFiles = req.files;

      if (!uploadedFiles || uploadedFiles.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      // Check if user is member or owner of the page
      const [page, membership] = await Promise.all([
        prisma.page.findUnique({
          where: { id: pageId },
          select: { id: true, name: true, ownerId: true },
        }),
        prisma.pageMember.findUnique({
          where: {
            userId_pageId: {
              userId,
              pageId,
            },
          },
        }),
      ]);

      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Check if user can post (owner or accepted member)
      const canPost =
        page.ownerId === userId ||
        (membership && membership.status === "accepted");
      if (!canPost) {
        return res.status(403).json({
          message:
            "You must be an accepted member to upload media to this page",
        });
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

      console.log(
        `✅ Successfully uploaded ${mediaFiles.length} media files for page ${pageId}`
      );

      return res.status(200).json({
        message: "Media files uploaded successfully",
        media: mediaFiles,
        uploadedCount: mediaFiles.length,
      });
    } catch (error) {
      console.error("Error uploading page media:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

export { router as pageRoute };
