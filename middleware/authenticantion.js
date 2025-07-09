import jwt from "jsonwebtoken";
import prisma from "../config/prismaConfig.js";

// Helper function to generate new access token
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      username: user.username,
      isAdmin: user.isAdmin || false,
      isProUser: user.isProUser || false,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" } // Short-lived access token
  );
};

// Helper function to generate new refresh token
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      username: user.username,
      isAdmin: user.isAdmin || false,
      isProUser: user.isProUser || false,
      type: "refresh",
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: "7d" } // Long-lived refresh token
  );
};

// Helper function for logout - clears both tokens
const clearAuthTokens = (res) => {
  res.clearCookie("token");
  res.clearCookie("refreshToken");
};

const authentication = (req, res, next) => {
  try {
    const token = req.cookies.token;
    const refreshToken = req.cookies.refreshToken;

    if (!token && !refreshToken) {
      return res
        .status(401)
        .json({ message: "Authentication tokens are missing" });
    }

    // Try to verify the access token first
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        return next();
      } catch (tokenError) {
        // Access token is invalid/expired, try refresh token
        if (tokenError.name === "TokenExpiredError" && refreshToken) {
          return handleTokenRefresh(req, res, next, refreshToken);
        } else {
          // Other token errors (malformed, etc.)
          return res.status(401).json({ message: "Invalid access token" });
        }
      }
    } else if (refreshToken) {
      // Only refresh token provided, try to refresh
      return handleTokenRefresh(req, res, next, refreshToken);
    }
  } catch (error) {
    console.error("Authentication error:", error);
    return res
      .status(500)
      .json({ message: "Internal server error during authentication" });
  }
};

// Separate function to handle token refresh
const handleTokenRefresh = async (req, res, next, refreshToken) => {
  try {
    // Verify refresh token
    const refreshDecoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );

    // Check if it's actually a refresh token
    if (refreshDecoded.type !== "refresh") {
      return res.status(401).json({ message: "Invalid refresh token type" });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: refreshDecoded.userId,
      },
      select: {
        id: true,
        email: true,
        username: true,
        isAdmin: true,
        isProUser: true,
      },
    });

    if (!user) {
      return res
        .status(401)
        .json({ message: "User not found or account deactivated" });
    }

    // Generate new tokens
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      isAdmin: user.isAdmin || false,
      isProUser: user.isProUser || false,
    };

    const newAccessToken = generateAccessToken(userData);
    const newRefreshToken = generateRefreshToken(userData);

    // Set new tokens in cookies
    res.cookie("token", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    req.user = {
      userId: user.id,
      email: user.email,
      username: user.username,
      isAdmin: user.isAdmin || false,
      isProUser: user.isProUser || false,
    };

    req.tokensRefreshed = true; // Flag to indicate tokens were refreshed

    return next();
  } catch (refreshError) {
    // Refresh token is also invalid
    clearAuthTokens(res);
    return res.status(401).json({
      message: "Refresh token expired or invalid. Please login again.",
    });
  }
};

export {
  authentication,
  generateAccessToken,
  generateRefreshToken,
  clearAuthTokens,
  handleTokenRefresh,
};
