import express from "express";
import prisma from "../config/prismaConfig.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, query, param, validationResult } from "express-validator";
import Cookies from "cookies";
import {
  authentication,
  generateAccessToken,
  generateRefreshToken,
  clearAuthTokens,
} from "../middleware/authenticantion.js";
import { uploadIdCard } from "../config/multer.js";
const router = express.Router();

router.post(
  "/register",
  uploadIdCard.single("idCard"),
  [
    body("username").notEmpty().withMessage("Username is required"),
    body("email").isEmail().withMessage("Invalid email format"),
    body("password")
      .isLength({ min: 6, max: 64 })
      .withMessage("Password must be at least 6 characters long"),
    body("name").notEmpty().withMessage("Name is required"),
    body("birthdate").notEmpty().withMessage("Birthdate is required"),
    body("gender").notEmpty().withMessage("Gender is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { username, email, password, name, bio, gender, birthdate } =
        req.body;
      const hashpassword = await bcrypt.hash(password, 10);

      if (!req.file) {
        return res.status(400).json({ message: "ID card is required" });
      }

      const user = await prisma.user.create({
        data: {
          username,
          email,
          password: hashpassword,
          name,
          bio,
          gender,
          birthdate: new Date(birthdate),
          idCard: req.file.filename,
        },
      });

      if (!user) {
        return res.status(500).json({ message: "User registration failed" });
      } else {
        return res.status(201).json({
          message: "User registered successfully",
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            idCard: user.idCard,
          },
        });
      }
    } catch (error) {
      if (error.code === "P2002") {
        return res
          .status(400)
          .json({ message: "Username or email already exists" });
      }
      console.error("Error during registration:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.post(
  "/login",
  [
    body("usernameormail").notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { usernameormail, password } = req.body;
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ username: usernameormail }, { email: usernameormail }],
        },
      });
      if (!user) {
        return res.status(404).json({ message: "User/Email not found" });
      }
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      } else {
        // Prepare user data for token generation
        const userData = {
          id: user.id,
          email: user.email,
          username: user.username,
          isAdmin: user.isAdmin,
        };

        // Generate tokens using the helper functions
        const token = generateAccessToken(userData);
        const refreshToken = generateRefreshToken(userData);

        // Set cookies with proper configuration
        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          // secure: true,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          // sameSite: "none",
          maxAge: 60 * 60 * 1000, // 15 minutes
        });

        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        return res.status(200).json({ message: "Login successful" });
      }
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.post("/logout", (req, res) => {
  try {
    clearAuthTokens(res);
    return res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error during logout:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/me", authentication, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      omit: {
        password: true,
        idCard: true,
      },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});
router.get(
  "/check/:emailorusername",
  [
    param("emailorusername")
      .notEmpty()
      .withMessage("Email or username is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { emailorusername } = req.params;

      // Check if the input is an email format
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailorusername);

      // Search for user by either email or username
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: emailorusername }, { username: emailorusername }],
          deletedAt: null, // Only check non-deleted users
        },
        select: {
          id: true,
          email: true,
          username: true,
        },
      });

      if (user) {
        // Determine which field matched
        const matchedField =
          user.email === emailorusername ? "email" : "username";

        return res.status(200).json({
          exists: true,
          matchedField: matchedField,
          isEmail: isEmail,
          message: `${
            matchedField === "email" ? "Email" : "Username"
          } already exists`,
        });
      } else {
        return res.status(200).json({
          exists: false,
          isEmail: isEmail,
          message: `${isEmail ? "Email" : "Username"} is available`,
        });
      }
    } catch (error) {
      console.error("Error checking email/username:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.get(
  "/search",
  [query("q").notEmpty().withMessage("Username is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { q } = req.query;
      const users = await prisma.user.findMany({
        where: {
          username: {
            contains: q,
          },
          deletedAt: null, // Only search non-deleted users
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          profilePicture: true,
          createdAt: true,
          updatedAt: true,
          isVerified: true,
          isProUser: true,
        },
      });
      if (users.length === 0) {
        return res.status(404).json({ message: "No users found" });
      }
      return res.status(200).json(users);
    } catch (error) {
      console.error("Error during search:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.get(
  "/user/:username",
  [param("username").notEmpty().withMessage("Username is required")],
  authentication,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const username = req.params.username;
      const user = await prisma.user.findUnique({
        where: {
          username,
          deletedAt: null,
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          bio: true,
          profilePicture: true,
          createdAt: true,
          updatedAt: true,
          isVerified: true,
          birthdate: true,
          location: true,
          isProUser: true,
          isAdmin: true,
          relationshipStatus: true,
          studyField: true,
          relationships: true,
          gender: true,
          coverPicture: true,
          posts: {
            where: { deletedAt: null },
            select: {
              id: true,
              content: true,
              createdAt: true,
              author: true,
              media: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  url: true,
                },
              },
            },
          },
          followers: {
            where: { deletedAt: null },
            select: {
              id: true,
            },
          },
          following: {
            where: { deletedAt: null },
            select: {
              id: true,
            },
          },
          friends: {
            where: { deletedAt: null },
            select: {
              id: true,
              userB: {
                select: {
                  id: true,
                  username: true,
                  profilePicture: true,
                  isVerified: true,
                },
              },
              status: true,
            },
          },
        },
      });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.status(200).json(user);
    } catch (error) {
      console.error("Error fetching user by username:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Check if email exists
router.get(
  "/check-email/:email",
  [
    param("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Invalid email format"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.params;

      const user = await prisma.user.findUnique({
        where: {
          email: email,
          deletedAt: null,
        },
        select: { id: true, email: true },
      });

      return res.status(200).json({
        exists: !!user,
        type: "email",
        value: email,
        message: user ? "Email already exists" : "Email is available",
      });
    } catch (error) {
      console.error("Error checking email:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Check if username exists
router.get(
  "/check-username/:username",
  [param("username").notEmpty().withMessage("Username is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username } = req.params;

      const user = await prisma.user.findUnique({
        where: {
          username: username,
          deletedAt: null,
        },
        select: { id: true, username: true },
      });

      return res.status(200).json({
        exists: !!user,
        type: "username",
        value: username,
        message: user ? "Username already exists" : "Username is available",
      });
    } catch (error) {
      console.error("Error checking username:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

export { router as authenticationRoute };
