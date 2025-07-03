import express from "express";
import { body, query, param, validationResult } from "express-validator";
import prisma from "../config/prismaConfig.js";
import { authentication } from "../middleware/authenticantion.js";
import { NotificationService } from "../services/notificationService.js";

const router = express.Router();

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
    query("search")
      .optional()
      .isLength({ min: 1 })
      .withMessage("Search term must not be empty"),
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
      const search = req.query.search || "";
      const skip = (page - 1) * limit;

      // Get friends where current user is either userA or userB
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [{ userAId: currentUserId }, { userBId: currentUserId }],
          status: "accepted", // Only accepted friendships
        },
        include: {
          userA: {
            select: {
              id: true,
              username: true,
              name: true,
              profilePicture: true,
              isVerified: true,
              bio: true,
            },
          },
          userB: {
            select: {
              id: true,
              username: true,
              name: true,
              profilePicture: true,
              isVerified: true,
              bio: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Extract the friend data (not the current user) and apply search filter
      const friends = friendships
        .map((friendship) => {
          const friend =
            friendship.userAId === currentUserId
              ? friendship.userB
              : friendship.userA;

          return {
            ...friend,
            friendshipId: friendship.id,
            friendsSince: friendship.createdAt,
          };
        })
        .filter((friend) => {
          // Apply search filter if provided
          if (!search) return true;
          return (
            friend.username.toLowerCase().includes(search.toLowerCase()) ||
            friend.name.toLowerCase().includes(search.toLowerCase())
          );
        })
        .slice(skip, skip + limit);

      // Get total count for pagination (with search filter if applied)
      let totalFriends;

      if (search) {
        // If search is provided, we need to count after filtering
        const allFriendships = await prisma.friendship.findMany({
          where: {
            OR: [{ userAId: currentUserId }, { userBId: currentUserId }],
            status: "accepted",
          },
          include: {
            userA: {
              select: {
                username: true,
                name: true,
              },
            },
            userB: {
              select: {
                username: true,
                name: true,
              },
            },
          },
        });

        const filteredFriends = allFriendships
          .map((friendship) => {
            const friend =
              friendship.userAId === currentUserId
                ? friendship.userB
                : friendship.userA;
            return friend;
          })
          .filter(
            (friend) =>
              friend.username.toLowerCase().includes(search.toLowerCase()) ||
              friend.name.toLowerCase().includes(search.toLowerCase())
          );

        totalFriends = filteredFriends.length;
      } else {
        // No search, just count all friendships
        totalFriends = await prisma.friendship.count({
          where: {
            OR: [{ userAId: currentUserId }, { userBId: currentUserId }],
            status: "accepted",
          },
        });
      }

      return res.status(200).json({
        friends: friends,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalFriends / limit),
          totalFriends: totalFriends,
          hasMore: skip + friends.length < totalFriends,
        },
      });
    } catch (error) {
      console.error("Error fetching friends list:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get specific user's friends list (public)
router.get(
  "/friends/:userId",
  [
    param("userId").notEmpty().withMessage("User ID is required"),
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

      const targetUserId = req.params.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          username: true,
          name: true,
          profilePicture: true,
        },
      });

      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get friends of the target user
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [{ userAId: targetUserId }, { userBId: targetUserId }],
          status: "accepted",
        },
        include: {
          userA: {
            select: {
              id: true,
              username: true,
              name: true,
              profilePicture: true,
              isVerified: true,
            },
          },
          userB: {
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
        skip: skip,
        take: limit,
      });

      // Extract friend data
      const friends = friendships.map((friendship) => {
        const friend =
          friendship.userAId === targetUserId
            ? friendship.userB
            : friendship.userA;

        return {
          ...friend,
          friendsSince: friendship.createdAt,
        };
      });

      // Get total count
      const totalFriends = await prisma.friendship.count({
        where: {
          OR: [{ userAId: targetUserId }, { userBId: targetUserId }],
          status: "accepted",
        },
      });

      return res.status(200).json({
        user: targetUser,
        friends: friends,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalFriends / limit),
          totalFriends: totalFriends,
          hasMore: skip + friends.length < totalFriends,
        },
      });
    } catch (error) {
      console.error("Error fetching user's friends list:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get mutual friends between current user and another user
router.get(
  "/mutual/:userId",
  [param("userId").notEmpty().withMessage("User ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const currentUserId = req.user.userId;
      const otherUserId = req.params.userId;

      if (currentUserId === otherUserId) {
        return res
          .status(400)
          .json({ message: "Cannot check mutual friends with yourself" });
      }

      // Get current user's friends
      const currentUserFriends = await prisma.friendship.findMany({
        where: {
          OR: [{ userAId: currentUserId }, { userBId: currentUserId }],
          status: "accepted",
        },
        select: {
          userAId: true,
          userBId: true,
        },
      });

      // Get other user's friends
      const otherUserFriends = await prisma.friendship.findMany({
        where: {
          OR: [{ userAId: otherUserId }, { userBId: otherUserId }],
          status: "accepted",
        },
        select: {
          userAId: true,
          userBId: true,
        },
      });

      // Extract friend IDs
      const currentUserFriendIds = currentUserFriends.map((f) =>
        f.userAId === currentUserId ? f.userBId : f.userAId
      );

      const otherUserFriendIds = otherUserFriends.map((f) =>
        f.userAId === otherUserId ? f.userBId : f.userAId
      );

      // Find mutual friend IDs
      const mutualFriendIds = currentUserFriendIds.filter((id) =>
        otherUserFriendIds.includes(id)
      );

      // Get mutual friends data
      const mutualFriends = await prisma.user.findMany({
        where: {
          id: { in: mutualFriendIds },
        },
        select: {
          id: true,
          username: true,
          name: true,
          profilePicture: true,
          isVerified: true,
        },
      });

      return res.status(200).json({
        mutualFriends: mutualFriends,
        count: mutualFriends.length,
      });
    } catch (error) {
      console.error("Error fetching mutual friends:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Check friendship status between two users
router.get(
  "/status/:userId",
  [param("userId").notEmpty().withMessage("User ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const currentUserId = req.user.userId;
      const otherUserId = req.params.userId;

      if (currentUserId === otherUserId) {
        return res
          .status(400)
          .json({ message: "Cannot check friendship with yourself" });
      }

      // Check friendship status (bidirectional search)
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userAId: currentUserId, userBId: otherUserId },
            { userAId: otherUserId, userBId: currentUserId },
          ],
        },
      });

      if (!friendship) {
        return res.status(200).json({ status: "none" });
      }

      // Determine the relationship from current user's perspective
      let relationshipStatus = friendship.status;
      let perspective = "none";

      if (friendship.status === "pending") {
        if (friendship.userAId === currentUserId) {
          perspective = "sent"; // Current user sent the request
        } else {
          perspective = "received"; // Current user received the request
        }
      }

      return res.status(200).json({
        status: relationshipStatus,
        perspective: perspective,
        friendship: friendship,
      });
    } catch (error) {
      console.error("Error checking friendship status:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Send friend request
router.post(
  "/request/:userId",
  [param("userId").notEmpty().withMessage("User ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const senderId = req.user.userId;
      const receiverId = req.params.userId;

      if (senderId === receiverId) {
        return res
          .status(400)
          .json({ message: "Cannot send friend request to yourself" });
      }

      // Check if receiver exists
      const receiverExists = await prisma.user.findUnique({
        where: { id: receiverId },
      });

      if (!receiverExists) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if friendship already exists
      const existingFriendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userAId: senderId, userBId: receiverId },
            { userAId: receiverId, userBId: senderId },
          ],
        },
      });

      if (existingFriendship) {
        if (existingFriendship.status === "accepted") {
          return res.status(400).json({ message: "Already friends" });
        } else if (existingFriendship.status === "pending") {
          // Check if the existing request is FROM the receiver TO the sender
          if (
            existingFriendship.userAId === receiverId &&
            existingFriendship.userBId === senderId
          ) {
            // Auto-accept and create mutual follows
            const acceptedFriendship = await prisma.friendship.update({
              where: { id: existingFriendship.id },
              data: { status: "accepted" },
              include: {
                userA: {
                  select: {
                    id: true,
                    username: true,
                    name: true,
                    profilePicture: true,
                  },
                },
                userB: {
                  select: {
                    id: true,
                    username: true,
                    name: true,
                    profilePicture: true,
                  },
                },
              },
            });

            // Create mutual follow relationships
            try {
              // Check if sender is already following receiver
              const existingFollow1 = await prisma.follower.findUnique({
                where: {
                  followerId_followingId: {
                    followerId: senderId,
                    followingId: receiverId,
                  },
                },
              });

              // Check if receiver is already following sender
              const existingFollow2 = await prisma.follower.findUnique({
                where: {
                  followerId_followingId: {
                    followerId: receiverId,
                    followingId: senderId,
                  },
                },
              });

              // Create follow relationships if they don't exist
              const followPromises = [];

              if (!existingFollow1) {
                followPromises.push(
                  prisma.follower.create({
                    data: {
                      followerId: senderId,
                      followingId: receiverId,
                    },
                  })
                );
              }

              if (!existingFollow2) {
                followPromises.push(
                  prisma.follower.create({
                    data: {
                      followerId: receiverId,
                      followingId: senderId,
                    },
                  })
                );
              }

              await Promise.all(followPromises);
            } catch (followError) {
              console.error(
                "Error creating follow relationships:",
                followError
              );
              // Don't fail the friendship creation if follow creation fails
            }

            // Create notification for friend request being auto-accepted
            await NotificationService.createFriendAcceptNotification(
              receiverId,
              senderId
            );

            return res.status(200).json({
              message:
                "Friend request automatically accepted! You are now friends and following each other.",
              friendship: acceptedFriendship,
              autoAccepted: true,
            });
          } else {
            // Same direction request already exists
            return res
              .status(400)
              .json({ message: "Friend request already exists" });
          }
        }
      }

      // Create new friendship request and follow relationship
      try {
        // Start transaction for friendship request and follow
        const result = await prisma.$transaction(async (tx) => {
          // Create friendship request (sender is always userA)
          const friendshipRequest = await tx.friendship.create({
            data: {
              userAId: senderId, // Sender
              userBId: receiverId, // Receiver
              status: "pending",
            },
            include: {
              userA: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  profilePicture: true,
                },
              },
              userB: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  profilePicture: true,
                },
              },
            },
          });

          // Check if sender is already following receiver
          const existingFollow = await tx.follower.findUnique({
            where: {
              followerId_followingId: {
                followerId: senderId,
                followingId: receiverId,
              },
            },
          });

          // Create follow relationship if it doesn't exist
          if (!existingFollow) {
            await tx.follower.create({
              data: {
                followerId: senderId,
                followingId: receiverId,
              },
            });
          }

          return friendshipRequest;
        });

        // Create notifications for friend request and follow
        await NotificationService.createFriendRequestNotification(
          senderId,
          receiverId
        );
        await NotificationService.createFollowNotification(
          senderId,
          receiverId
        );

        return res.status(201).json({
          message:
            "Friend request sent successfully and you are now following them",
          friendship: result,
          autoAccepted: false,
        });
      } catch (transactionError) {
        console.error("Error in friendship transaction:", transactionError);
        return res
          .status(500)
          .json({ message: "Failed to process friend request" });
      }
    } catch (error) {
      console.error("Error creating friendship request:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Accept friend request
router.put(
  "/accept/:friendshipId",
  [param("friendshipId").notEmpty().withMessage("Friendship ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const friendshipId = req.params.friendshipId;
      const currentUserId = req.user.userId;

      // Find the friendship request
      const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId },
      });

      if (!friendship) {
        return res.status(404).json({ message: "Friend request not found" });
      }

      // Only the receiver (userB) can accept the request
      if (friendship.userBId !== currentUserId) {
        return res.status(403).json({
          message: "You can only accept requests sent to you",
        });
      }

      if (friendship.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Friend request is not pending" });
      }

      // Accept friendship and create mutual follow relationship
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Accept the friendship
          const updatedFriendship = await tx.friendship.update({
            where: { id: friendshipId },
            data: { status: "accepted" },
            include: {
              userA: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  profilePicture: true,
                },
              },
              userB: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  profilePicture: true,
                },
              },
            },
          });

          const senderId = friendship.userAId;
          const receiverId = friendship.userBId;

          // Check existing follow relationships
          const existingFollow1 = await tx.follower.findUnique({
            where: {
              followerId_followingId: {
                followerId: senderId,
                followingId: receiverId,
              },
            },
          });

          const existingFollow2 = await tx.follower.findUnique({
            where: {
              followerId_followingId: {
                followerId: receiverId,
                followingId: senderId,
              },
            },
          });

          // Create follow relationships if they don't exist
          const followPromises = [];

          if (!existingFollow1) {
            followPromises.push(
              tx.follower.create({
                data: {
                  followerId: senderId,
                  followingId: receiverId,
                },
              })
            );
          }

          if (!existingFollow2) {
            followPromises.push(
              tx.follower.create({
                data: {
                  followerId: receiverId,
                  followingId: senderId,
                },
              })
            );
          }

          await Promise.all(followPromises);

          return updatedFriendship;
        });

        // Create notification for friend request acceptance
        await NotificationService.createFriendAcceptNotification(
          friendship.userAId,
          currentUserId
        );

        return res.status(200).json({
          message:
            "Friend request accepted and you are now following each other",
          friendship: result,
        });
      } catch (transactionError) {
        console.error(
          "Error in accept friendship transaction:",
          transactionError
        );
        return res
          .status(500)
          .json({ message: "Failed to accept friend request" });
      }
    } catch (error) {
      console.error("Error accepting friendship:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get pending friend requests (received)
router.get("/requests/received", authentication, async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    const pendingRequests = await prisma.friendship.findMany({
      where: {
        userBId: currentUserId, // Current user is the receiver
        status: "pending",
      },
      include: {
        userA: {
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
    });

    return res.status(200).json({
      requests: pendingRequests,
      count: pendingRequests.length,
    });
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Get sent friend requests
router.get("/requests/sent", authentication, async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    const sentRequests = await prisma.friendship.findMany({
      where: {
        userAId: currentUserId, // Current user is the sender
        status: "pending",
      },
      include: {
        userB: {
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
    });

    return res.status(200).json({
      requests: sentRequests,
      count: sentRequests.length,
    });
  } catch (error) {
    console.error("Error fetching sent requests:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Unfriend - Remove friendship and mutual follows
router.delete(
  "/unfriend/:userId",
  [param("userId").notEmpty().withMessage("User ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const currentUserId = req.user.userId;
      const targetUserId = req.params.userId;

      if (currentUserId === targetUserId) {
        return res.status(400).json({ message: "Cannot unfriend yourself" });
      }

      // Find the friendship
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userAId: currentUserId, userBId: targetUserId },
            { userAId: targetUserId, userBId: currentUserId },
          ],
          status: "accepted", // Only unfriend if they are actually friends
        },
        include: {
          userA: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
          userB: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
        },
      });

      if (!friendship) {
        return res.status(404).json({
          message: "Friendship not found or you are not friends with this user",
        });
      }

      // Remove friendship and mutual follow relationships
      try {
        await prisma.$transaction(async (tx) => {
          // Delete the friendship
          await tx.friendship.delete({
            where: { id: friendship.id },
          });

          // Delete mutual follow relationships if they exist
          const followPromises = [];

          // Remove currentUser following targetUser
          followPromises.push(
            tx.follower.deleteMany({
              where: {
                followerId: currentUserId,
                followingId: targetUserId,
              },
            })
          );

          // Remove targetUser following currentUser
          followPromises.push(
            tx.follower.deleteMany({
              where: {
                followerId: targetUserId,
                followingId: currentUserId,
              },
            })
          );

          await Promise.all(followPromises);
        });

        const unfriendedUser =
          friendship.userAId === currentUserId
            ? friendship.userB
            : friendship.userA;

        return res.status(200).json({
          message: "Successfully unfriended and unfollowed each other",
          unfriendedUser: unfriendedUser,
        });
      } catch (transactionError) {
        console.error("Error in unfriend transaction:", transactionError);
        return res.status(500).json({ message: "Failed to unfriend user" });
      }
    } catch (error) {
      console.error("Error unfriending user:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Cancel friend request (for pending requests)
router.delete(
  "/cancel/:friendshipId",
  [param("friendshipId").notEmpty().withMessage("Friendship ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const friendshipId = req.params.friendshipId;
      const currentUserId = req.user.userId;

      // Find the friendship request
      const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId },
        include: {
          userA: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
          userB: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
        },
      });

      if (!friendship) {
        return res.status(404).json({ message: "Friend request not found" });
      }

      // Only the sender (userA) can cancel the request
      if (friendship.userAId !== currentUserId) {
        return res.status(403).json({
          message: "You can only cancel requests you sent",
        });
      }

      if (friendship.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Can only cancel pending friend requests" });
      }

      // Cancel the request and remove the follow relationship
      try {
        await prisma.$transaction(async (tx) => {
          // Delete the friendship request
          await tx.friendship.delete({
            where: { id: friendshipId },
          });

          // Remove the follow relationship (sender was following receiver)
          await tx.follower.deleteMany({
            where: {
              followerId: friendship.userAId,
              followingId: friendship.userBId,
            },
          });
        });

        return res.status(200).json({
          message: "Friend request cancelled and unfollowed user",
          cancelledRequest: {
            user: friendship.userB,
            wasFollowing: true,
          },
        });
      } catch (transactionError) {
        console.error("Error in cancel request transaction:", transactionError);
        return res
          .status(500)
          .json({ message: "Failed to cancel friend request" });
      }
    } catch (error) {
      console.error("Error cancelling friend request:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Reject friend request (for received requests)
router.delete(
  "/reject/:friendshipId",
  [param("friendshipId").notEmpty().withMessage("Friendship ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const friendshipId = req.params.friendshipId;
      const currentUserId = req.user.userId;

      // Find the friendship request
      const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId },
        include: {
          userA: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
        },
      });

      if (!friendship) {
        return res.status(404).json({ message: "Friend request not found" });
      }

      // Only the receiver (userB) can reject the request
      if (friendship.userBId !== currentUserId) {
        return res.status(403).json({
          message: "You can only reject requests sent to you",
        });
      }

      if (friendship.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Can only reject pending friend requests" });
      }

      // Reject the request (just delete it)
      try {
        await prisma.$transaction(async (tx) => {
          // Delete the friendship request
          await tx.friendship.delete({
            where: { id: friendshipId },
          });

          // Note: We don't remove the follow relationship here
          // because the sender might still want to follow the receiver
          // even if the friend request was rejected
        });

        return res.status(200).json({
          message: "Friend request rejected",
          rejectedRequest: {
            user: friendship.userA,
          },
        });
      } catch (transactionError) {
        console.error("Error in reject request transaction:", transactionError);
        return res
          .status(500)
          .json({ message: "Failed to reject friend request" });
      }
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Follow a user
router.post(
  "/follow/:userId",
  [param("userId").notEmpty().withMessage("User ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const followerId = req.user.userId;
      const followingId = req.params.userId;

      if (followerId === followingId) {
        return res.status(400).json({ message: "Cannot follow yourself" });
      }

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: followingId },
        select: {
          id: true,
          username: true,
          name: true,
          profilePicture: true,
          isVerified: true,
        },
      });

      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if already following
      const existingFollow = await prisma.follower.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (existingFollow) {
        return res.status(400).json({ message: "Already following this user" });
      }

      // Check if there's an existing friendship
      const existingFriendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userAId: followerId, userBId: followingId },
            { userAId: followingId, userBId: followerId },
          ],
        },
      });

      // Check if target user is already following the current user (mutual follow scenario)
      const targetFollowingCurrent = await prisma.follower.findUnique({
        where: {
          followerId_followingId: {
            followerId: followingId,
            followingId: followerId,
          },
        },
      });

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Create the follow relationship
          const follow = await tx.follower.create({
            data: {
              followerId,
              followingId,
            },
          });

          let friendship = null;
          let friendshipCreated = false;

          // If target is already following current user AND no friendship exists, create friendship
          if (targetFollowingCurrent && !existingFriendship) {
            friendship = await tx.friendship.create({
              data: {
                userAId: followerId, // Current user becomes userA
                userBId: followingId, // Target user becomes userB
                status: "accepted", // Auto-accept since it's mutual follow
              },
              include: {
                userA: {
                  select: {
                    id: true,
                    username: true,
                    name: true,
                    profilePicture: true,
                    isVerified: true,
                  },
                },
                userB: {
                  select: {
                    id: true,
                    username: true,
                    name: true,
                    profilePicture: true,
                    isVerified: true,
                  },
                },
              },
            });
            friendshipCreated = true;
          }

          return { follow, friendship, friendshipCreated };
        });

        // Create notifications
        await NotificationService.createFollowNotification(
          followerId,
          followingId
        );

        if (result.friendshipCreated) {
          // Create friendship notification for both users
          await NotificationService.createFriendAcceptNotification(
            followingId,
            followerId
          );
        }

        const responseMessage = result.friendshipCreated
          ? "Successfully followed user and became friends (mutual follow)!"
          : "Successfully followed user";

        return res.status(201).json({
          message: responseMessage,
          follow: result.follow,
          friendship: result.friendship,
          friendshipCreated: result.friendshipCreated,
          user: targetUser,
        });
      } catch (transactionError) {
        console.error("Error in follow transaction:", transactionError);
        return res.status(500).json({ message: "Failed to follow user" });
      }
    } catch (error) {
      console.error("Error following user:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Unfollow a user
router.delete(
  "/unfollow/:userId",
  [param("userId").notEmpty().withMessage("User ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const followerId = req.user.userId;
      const followingId = req.params.userId;

      if (followerId === followingId) {
        return res.status(400).json({ message: "Cannot unfollow yourself" });
      }

      // Check if currently following
      const existingFollow = await prisma.follower.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (!existingFollow) {
        return res.status(404).json({ message: "Not following this user" });
      }

      // Check if there's an accepted friendship
      const existingFriendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userAId: followerId, userBId: followingId },
            { userAId: followingId, userBId: followerId },
          ],
          status: "accepted",
        },
      });

      try {
        await prisma.$transaction(async (tx) => {
          // Remove the follow relationship
          await tx.follower.delete({
            where: {
              followerId_followingId: {
                followerId,
                followingId,
              },
            },
          });

          // If there's a friendship, remove it (since one person unfollowed)
          if (existingFriendship) {
            await tx.friendship.delete({
              where: { id: existingFriendship.id },
            });
          }
        });

        const message = existingFriendship
          ? "Successfully unfollowed user and friendship ended"
          : "Successfully unfollowed user";

        return res.status(200).json({
          message,
          friendshipRemoved: !!existingFriendship,
        });
      } catch (transactionError) {
        console.error("Error in unfollow transaction:", transactionError);
        return res.status(500).json({ message: "Failed to unfollow user" });
      }
    } catch (error) {
      console.error("Error unfollowing user:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get user's followers
router.get(
  "/followers/:userId",
  [
    param("userId").notEmpty().withMessage("User ID is required"),
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

      const targetUserId = req.params.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          username: true,
          name: true,
          profilePicture: true,
        },
      });

      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get followers
      const [followers, totalFollowers] = await Promise.all([
        prisma.follower.findMany({
          where: { followingId: targetUserId },
          include: {
            follower: {
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
        prisma.follower.count({
          where: { followingId: targetUserId },
        }),
      ]);

      const followersData = followers.map((f) => ({
        ...f.follower,
        followedAt: f.createdAt,
      }));

      return res.status(200).json({
        user: targetUser,
        followers: followersData,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalFollowers / limit),
          totalFollowers,
          hasMore: skip + followers.length < totalFollowers,
        },
      });
    } catch (error) {
      console.error("Error fetching followers:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Get user's following
router.get(
  "/following/:userId",
  [
    param("userId").notEmpty().withMessage("User ID is required"),
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

      const targetUserId = req.params.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          username: true,
          name: true,
          profilePicture: true,
        },
      });

      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get following
      const [following, totalFollowing] = await Promise.all([
        prisma.follower.findMany({
          where: { followerId: targetUserId },
          include: {
            following: {
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
        prisma.follower.count({
          where: { followerId: targetUserId },
        }),
      ]);

      const followingData = following.map((f) => ({
        ...f.following,
        followedAt: f.createdAt,
      }));

      return res.status(200).json({
        user: targetUser,
        following: followingData,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalFollowing / limit),
          totalFollowing,
          hasMore: skip + following.length < totalFollowing,
        },
      });
    } catch (error) {
      console.error("Error fetching following:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Check follow status between users
router.get(
  "/follow-status/:userId",
  [param("userId").notEmpty().withMessage("User ID is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const currentUserId = req.user.userId;
      const targetUserId = req.params.userId;

      if (currentUserId === targetUserId) {
        return res
          .status(400)
          .json({ message: "Cannot check follow status with yourself" });
      }

      // Check follow relationships
      const [currentFollowsTarget, targetFollowsCurrent] = await Promise.all([
        prisma.follower.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: targetUserId,
            },
          },
        }),
        prisma.follower.findUnique({
          where: {
            followerId_followingId: {
              followerId: targetUserId,
              followingId: currentUserId,
            },
          },
        }),
      ]);

      return res.status(200).json({
        isFollowing: !!currentFollowsTarget,
        isFollowedBy: !!targetFollowsCurrent,
        isMutual: !!(currentFollowsTarget && targetFollowsCurrent),
        followedAt: currentFollowsTarget?.createdAt || null,
        followedByAt: targetFollowsCurrent?.createdAt || null,
      });
    } catch (error) {
      console.error("Error checking follow status:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

export { router as friendshipRoute };
