import express from "express";
import { PrismaClient } from "../generated/prisma/index.js";
import { authentication } from "../middleware/authenticantion.js";
import { SoftDeleteService } from "../services/softDeleteService.js";

const router = express.Router();
const prisma = new PrismaClient();

// Validation helper
const validateReportData = (
  reportType,
  postId,
  commentId,
  accountId,
  pageId
) => {
  const errors = [];

  // Ensure only one target is specified based on reportType
  switch (reportType) {
    case "post":
      if (!postId) errors.push("Post ID is required when reporting a post");
      if (commentId || accountId || pageId)
        errors.push("Only postId should be provided when reporting a post");
      break;
    case "comment":
      if (!commentId)
        errors.push("Comment ID is required when reporting a comment");
      if (postId || accountId || pageId)
        errors.push(
          "Only commentId should be provided when reporting a comment"
        );
      break;
    case "account":
      if (!accountId)
        errors.push("Account ID is required when reporting an account");
      if (postId || commentId || pageId)
        errors.push(
          "Only accountId should be provided when reporting an account"
        );
      break;
    case "page":
      if (!pageId) errors.push("Page ID is required when reporting a page");
      if (postId || commentId || accountId)
        errors.push("Only pageId should be provided when reporting a page");
      break;
    default:
      errors.push(
        "Invalid report type. Must be one of: post, comment, account, page"
      );
  }

  return errors;
};

// Validation helper for report reasons
const validReportReasons = [
  "spam",
  "harassment",
  "hate_speech",
  "violence",
  "nudity",
  "false_information",
  "intellectual_property",
  "self_harm",
  "terrorism",
  "bullying",
  "impersonation",
  "other",
];

// Create a new report
router.post("/create", authentication, async (req, res) => {
  try {
    const {
      reportType,
      reason,
      description,
      postId,
      commentId,
      accountId,
      pageId,
    } = req.body;

    // Validate required fields
    if (!reportType || !reason) {
      return res.status(400).json({
        success: false,
        message: "Report type and reason are required",
      });
    }

    // Validate report reason
    if (!validReportReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: `Invalid report reason. Must be one of: ${validReportReasons.join(
          ", "
        )}`,
      });
    }

    // Validate report data
    const validationErrors = validateReportData(
      reportType,
      postId,
      commentId,
      accountId,
      pageId
    );
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: validationErrors,
      });
    }

    // Check if the target entity exists and is not soft deleted
    let targetExists = false;
    let targetEntity = null;

    switch (reportType) {
      case "post":
        targetEntity = await prisma.post.findFirst({
          where: SoftDeleteService.buildWhereClause({ id: postId }),
        });
        targetExists = !!targetEntity;
        break;
      case "comment":
        targetEntity = await prisma.comment.findFirst({
          where: SoftDeleteService.buildWhereClause({ id: commentId }),
        });
        targetExists = !!targetEntity;
        break;
      case "account":
        targetEntity = await prisma.user.findFirst({
          where: SoftDeleteService.buildWhereClause({ id: accountId }),
        });
        targetExists = !!targetEntity;
        break;
      case "page":
        targetEntity = await prisma.page.findFirst({
          where: SoftDeleteService.buildWhereClause({ id: pageId }),
        });
        targetExists = !!targetEntity;
        break;
    }

    if (!targetExists) {
      return res.status(404).json({
        success: false,
        message: `The ${reportType} you are trying to report does not exist or has been removed`,
      });
    }

    // Check if user has already reported this entity
    const existingReport = await prisma.report.findFirst({
      where: SoftDeleteService.buildWhereClause({
        reporterId: req.user.userId,
        reportType,
        ...(postId && { postId }),
        ...(commentId && { commentId }),
        ...(accountId && { accountId }),
        ...(pageId && { pageId }),
        status: {
          in: ["pending", "accepted"], // Don't allow duplicate reports for pending/accepted
        },
      }),
    });

    if (existingReport) {
      return res.status(409).json({
        success: false,
        message: "You have already reported this content",
      });
    }

    // Prevent users from reporting themselves
    if (reportType === "account" && accountId === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot report yourself",
      });
    }

    // For posts and comments, check if user is reporting their own content
    if (reportType === "post" && targetEntity.authorId === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot report your own post",
      });
    }

    if (reportType === "comment" && targetEntity.userId === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot report your own comment",
      });
    }

    // Create the report
    const report = await prisma.report.create({
      data: {
        reporterId: req.user.userId,
        reportType,
        reason,
        description: description || null,
        postId: postId || null,
        commentId: commentId || null,
        accountId: accountId || null,
        pageId: pageId || null,
        status: "pending",
      },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        reportedPost:
          reportType === "post"
            ? {
                select: {
                  id: true,
                  content: true,
                  author: {
                    select: {
                      id: true,
                      username: true,
                      name: true,
                    },
                  },
                },
              }
            : false,
        reportedComment:
          reportType === "comment"
            ? {
                select: {
                  id: true,
                  content: true,
                  user: {
                    select: {
                      id: true,
                      username: true,
                      name: true,
                    },
                  },
                },
              }
            : false,
        reportedAccount:
          reportType === "account"
            ? {
                select: {
                  id: true,
                  username: true,
                  name: true,
                },
              }
            : false,
        reportedPage:
          reportType === "page"
            ? {
                select: {
                  id: true,
                  name: true,
                },
              }
            : false,
      },
    });

    res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      data: {
        report,
      },
    });
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get user's reports (reports they have made)
router.get("/my-reports", authentication, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, reportType } = req.query;
    const skip = (page - 1) * limit;

    let whereClause = {
      reporterId: req.user.userId,
    };

    if (status) {
      whereClause.status = status;
    }

    if (reportType) {
      whereClause.reportType = reportType;
    }

    whereClause = SoftDeleteService.buildWhereClause(whereClause);

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where: whereClause,
        include: {
          reportedPost: {
            select: {
              id: true,
              content: true,
              author: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                },
              },
            },
          },
          reportedComment: {
            select: {
              id: true,
              content: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                },
              },
            },
          },
          reportedAccount: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
          reportedPage: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: parseInt(skip),
        take: parseInt(limit),
      }),
      prisma.report.count({
        where: whereClause,
      }),
    ]);

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalReports: total,
          hasNextPage: skip + reports.length < total,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching user reports:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Admin routes - Get all reports for review
router.get("/admin/all", authentication, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const {
      page = 1,
      limit = 20,
      status,
      reportType,
      reason,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (page - 1) * limit;

    let whereClause = {};

    if (status) {
      whereClause.status = status;
    }

    if (reportType) {
      whereClause.reportType = reportType;
    }

    if (reason) {
      whereClause.reason = reason;
    }

    whereClause = SoftDeleteService.buildWhereClause(whereClause);

    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where: whereClause,
        include: {
          reporter: {
            select: {
              id: true,
              username: true,
              name: true,
              email: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
          reportedPost: {
            select: {
              id: true,
              content: true,
              author: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                },
              },
            },
          },
          reportedComment: {
            select: {
              id: true,
              content: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                },
              },
            },
          },
          reportedAccount: {
            select: {
              id: true,
              username: true,
              name: true,
              email: true,
            },
          },
          reportedPage: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
        orderBy,
        skip: parseInt(skip),
        take: parseInt(limit),
      }),
      prisma.report.count({
        where: whereClause,
      }),
    ]);

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalReports: total,
          hasNextPage: skip + reports.length < total,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching admin reports:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Admin route - Review a report (accept/reject)
router.put("/admin/review/:reportId", authentication, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { reportId } = req.params;
    const { status, reviewNote, actionTaken } = req.body;

    // Validate status
    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'accepted' or 'rejected'",
      });
    }

    // Check if report exists and is pending
    const existingReport = await prisma.report.findFirst({
      where: SoftDeleteService.buildWhereClause({ id: reportId }),
    });

    if (!existingReport) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    if (existingReport.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Report has already been reviewed",
      });
    }

    // Update the report
    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        reviewedBy: req.user.userId,
        reviewNote: reviewNote || null,
        actionTaken: actionTaken || null,
        reviewedAt: new Date(),
      },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        reportedPost: {
          select: {
            id: true,
            content: true,
            author: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
        },
        reportedComment: {
          select: {
            id: true,
            content: true,
            user: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
        },
        reportedAccount: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        reportedPage: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: `Report ${status} successfully`,
      data: {
        report: updatedReport,
      },
    });
  } catch (error) {
    console.error("Error reviewing report:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get report statistics (admin only)
router.get("/admin/stats", authentication, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const baseWhereClause = SoftDeleteService.buildWhereClause({});

    const [
      totalReports,
      pendingReports,
      acceptedReports,
      rejectedReports,
      reportsByType,
      reportsByReason,
      recentReports,
    ] = await Promise.all([
      prisma.report.count({ where: baseWhereClause }),
      prisma.report.count({
        where: SoftDeleteService.buildWhereClause({ status: "pending" }),
      }),
      prisma.report.count({
        where: SoftDeleteService.buildWhereClause({ status: "accepted" }),
      }),
      prisma.report.count({
        where: SoftDeleteService.buildWhereClause({ status: "rejected" }),
      }),
      prisma.report.groupBy({
        by: ["reportType"],
        where: baseWhereClause,
        _count: {
          id: true,
        },
      }),
      prisma.report.groupBy({
        by: ["reason"],
        where: baseWhereClause,
        _count: {
          id: true,
        },
      }),
      prisma.report.findMany({
        where: SoftDeleteService.buildWhereClause({ status: "pending" }),
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          reporter: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          total: totalReports,
          pending: pendingReports,
          accepted: acceptedReports,
          rejected: rejectedReports,
        },
        reportsByType: reportsByType.map((item) => ({
          type: item.reportType,
          count: item._count.id,
        })),
        reportsByReason: reportsByReason.map((item) => ({
          reason: item.reason,
          count: item._count.id,
        })),
        recentReports,
      },
    });
  } catch (error) {
    console.error("Error fetching report stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get a single report by ID (admin only)
router.get("/admin/:reportId", authentication, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { reportId } = req.params;

    const report = await prisma.report.findFirst({
      where: SoftDeleteService.buildWhereClause({ id: reportId }),
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
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
        reportedPost: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
        },
        reportedComment: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
        },
        reportedAccount: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
        reportedPage: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
          },
        },
      },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    res.json({
      success: true,
      data: {
        report,
      },
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

export default router;
