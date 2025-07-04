import express from "express";
import prisma from "../config/prismaConfig.js";
import { body, query, param, validationResult } from "express-validator";
import { authentication } from "../middleware/authenticantion.js";
import { uploadVerificationDocs } from "../config/multer.js";

const router = express.Router();

// Submit a verification request
router.post(
  "/submit",
  uploadVerificationDocs.array("documents", 5),
  [
    body("reason")
      .notEmpty()
      .withMessage("Reason for verification is required")
      .isLength({ min: 50, max: 1000 })
      .withMessage("Reason must be between 50 and 1000 characters"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reason } = req.body;
      const userId = req.user.userId;
      const existingRequest = await prisma.verificationRequest.findFirst({
        where: {
          userId,
          status: "pending",
        },
      });

      if (existingRequest) {
        return res.status(400).json({
          message: "You already have a pending verification request",
        });
      }

      // Check if user is already verified
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isVerified: true },
      });

      if (user.isVerified) {
        return res.status(400).json({
          message: "You are already verified",
        });
      }

      // Check if user has a pending verification request

      // Process uploaded documents
      let documentsUrls = [];
      if (req.files && req.files.length > 0) {
        documentsUrls = req.files.map((file) => file.filename);
      }

      // Create verification request
      const verificationRequest = await prisma.verificationRequest.create({
        data: {
          userId,
          reason,
          documents:
            documentsUrls.length > 0 ? JSON.stringify(documentsUrls) : null,
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
        },
      });

      // Send notification to admins about new verification request
      try {
        const admins = await prisma.user.findMany({
          where: { isAdmin: true },
          select: { id: true },
        });

        const notificationPromises = admins.map((admin) =>
          prisma.notification.create({
            data: {
              userId: admin.id,
              senderId: userId,
              type: "mention", // Using mention as closest type
              title: "New Verification Request",
              content: `${verificationRequest.user.name} submitted a verification request`,
            },
          })
        );

        await Promise.all(notificationPromises);
      } catch (notificationError) {
        console.error("Error sending admin notifications:", notificationError);
      }

      return res.status(201).json({
        message: "Verification request submitted successfully",
        request: verificationRequest,
      });
    } catch (error) {
      console.error("Error submitting verification request:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get user's verification requests
router.get(
  "/my-requests",
  [
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

      const userId = req.user.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const [requests, totalCount] = await Promise.all([
        prisma.verificationRequest.findMany({
          where: { userId },
          include: {
            reviewer: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.verificationRequest.count({
          where: { userId },
        }),
      ]);

      return res.status(200).json({
        requests,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasMore: skip + requests.length < totalCount,
        },
      });
    } catch (error) {
      console.error("Error fetching user verification requests:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get all verification requests (Admin only)
router.get(
  "/all",
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
      .isIn(["pending", "accepted", "rejected"])
      .withMessage("Status must be pending, accepted, or rejected"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          message: "Access denied. Admin privileges required.",
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const status = req.query.status;

      const where = status ? { status } : {};

      const [requests, totalCount] = await Promise.all([
        prisma.verificationRequest.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                profilePicture: true,
                isVerified: true,
                createdAt: true,
              },
            },
            reviewer: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
          orderBy: [
            { status: "asc" }, // Pending first
            { createdAt: "desc" },
          ],
          skip,
          take: limit,
        }),
        prisma.verificationRequest.count({ where }),
      ]);

      return res.status(200).json({
        requests,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasMore: skip + requests.length < totalCount,
        },
      });
    } catch (error) {
      console.error("Error fetching verification requests:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get verification request details
router.get(
  "/:requestId",
  [param("requestId").isUUID().withMessage("Valid request ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { requestId } = req.params;
      const userId = req.user.userId;
      const isAdmin = req.user.isAdmin;

      const request = await prisma.verificationRequest.findUnique({
        where: { id: requestId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              profilePicture: true,
              isVerified: true,
              createdAt: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
        },
      });

      if (!request) {
        return res
          .status(404)
          .json({ message: "Verification request not found" });
      }

      // Check if user can view this request
      if (request.userId !== userId && !isAdmin) {
        return res.status(403).json({
          message: "You can only view your own verification requests",
        });
      }

      return res.status(200).json({ request });
    } catch (error) {
      console.error("Error fetching verification request:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Approve verification request (Admin only)
router.patch(
  "/:requestId/approve",
  [
    param("requestId").notEmpty().withMessage("Valid request ID is required"),
    body("reviewNote")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Review note must be less than 500 characters"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      if (!req.user.isAdmin) {
        return res.status(403).json({
          message: "Access denied. Admin privileges required.",
        });
      }

      const { requestId } = req.params;
      const { reviewNote } = req.body;
      const reviewerId = req.user.userId;

      // Find the request
      const request = await prisma.verificationRequest.findUnique({
        where: { id: requestId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
        },
      });

      if (!request) {
        return res
          .status(404)
          .json({ message: "Verification request not found" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({
          message: `Request has already been ${request.status}`,
        });
      }

      // Update request and verify user
      const [updatedRequest, updatedUser] = await Promise.all([
        prisma.verificationRequest.update({
          where: { id: requestId },
          data: {
            status: "accepted",
            reviewedBy: reviewerId,
            reviewNote: reviewNote || null,
            reviewedAt: new Date(),
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
            reviewer: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
        }),
        prisma.user.update({
          where: { id: request.userId },
          data: { isVerified: true },
        }),
      ]);

      // Send notification to user
      try {
        await prisma.notification.create({
          data: {
            userId: request.userId,
            senderId: reviewerId,
            type: "mention",
            title: "Verification Approved",
            content: `Congratulations! Your verification request has been approved. You are now verified!`,
          },
        });
      } catch (notificationError) {
        console.error("Error sending notification:", notificationError);
      }

      return res.status(200).json({
        message: `${request.user.name} has been verified successfully`,
        request: updatedRequest,
      });
    } catch (error) {
      console.error("Error approving verification request:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Reject verification request (Admin only)
router.patch(
  "/:requestId/reject",
  [
    param("requestId").isUUID().withMessage("Valid request ID is required"),
    body("reviewNote")
      .notEmpty()
      .withMessage("Review note is required for rejection")
      .isLength({ max: 500 })
      .withMessage("Review note must be less than 500 characters"),
  ],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          message: "Access denied. Admin privileges required.",
        });
      }

      const { requestId } = req.params;
      const { reviewNote } = req.body;
      const reviewerId = req.user.userId;

      // Find the request
      const request = await prisma.verificationRequest.findUnique({
        where: { id: requestId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
        },
      });

      if (!request) {
        return res
          .status(404)
          .json({ message: "Verification request not found" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({
          message: `Request has already been ${request.status}`,
        });
      }

      // Update request
      const updatedRequest = await prisma.verificationRequest.update({
        where: { id: requestId },
        data: {
          status: "rejected",
          reviewedBy: reviewerId,
          reviewNote,
          reviewedAt: new Date(),
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
          reviewer: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
        },
      });

      // Send notification to user
      try {
        await prisma.notification.create({
          data: {
            userId: request.userId,
            senderId: reviewerId,
            type: "mention",
            title: "Verification Rejected",
            content: `Your verification request has been rejected. Reason: ${reviewNote}`,
          },
        });
      } catch (notificationError) {
        console.error("Error sending notification:", notificationError);
      }

      return res.status(200).json({
        message: `${request.user.name}'s verification request has been rejected`,
        request: updatedRequest,
      });
    } catch (error) {
      console.error("Error rejecting verification request:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get verification statistics (Admin only)
router.get("/stats/overview", authentication, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        message: "Access denied. Admin privileges required.",
      });
    }

    const [
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      totalVerifiedUsers,
      recentRequests,
    ] = await Promise.all([
      prisma.verificationRequest.count(),
      prisma.verificationRequest.count({ where: { status: "pending" } }),
      prisma.verificationRequest.count({ where: { status: "accepted" } }),
      prisma.verificationRequest.count({ where: { status: "rejected" } }),
      prisma.user.count({ where: { isVerified: true } }),
      prisma.verificationRequest.findMany({
        where: { status: "pending" },
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
        take: 5,
      }),
    ]);

    return res.status(200).json({
      stats: {
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        totalVerifiedUsers,
        approvalRate:
          totalRequests > 0
            ? ((approvedRequests / totalRequests) * 100).toFixed(2)
            : 0,
      },
      recentRequests,
    });
  } catch (error) {
    console.error("Error fetching verification statistics:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export { router as verificationRoute };
