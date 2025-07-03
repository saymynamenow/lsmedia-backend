import jwt from "jsonwebtoken";

// Helper function to generate new access token
const generateAccessToken = (user) => {
  // console.log("Generating access token for user:", user.id);
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      username: user.username,
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
          try {
            // Verify refresh token
            const refreshDecoded = jwt.verify(
              refreshToken,
              process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
            );

            // Check if it's actually a refresh token
            if (refreshDecoded.type !== "refresh") {
              return res
                .status(401)
                .json({ message: "Invalid refresh token type" });
            }

            // Generate new tokens
            const userData = {
              id: refreshDecoded.userId,
              email: refreshDecoded.email,
              username: refreshDecoded.username,
            };

            const newAccessToken = generateAccessToken(userData);
            const newRefreshToken = generateRefreshToken(userData);

            // Set new tokens in cookies
            res.cookie("token", newAccessToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "strict",
              maxAge: 60 * 60 * 1000,
            });

            res.cookie("refreshToken", newRefreshToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "strict",
              maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            });

            // Set user data for the request
            req.user = jwt.verify(newAccessToken, process.env.JWT_SECRET);
            req.tokensRefreshed = true; // Flag to indicate tokens were refreshed

            return next();
          } catch (refreshError) {
            // Refresh token is also invalid
            return res.status(401).json({
              message:
                "Both access and refresh tokens are invalid. Please login again.",
            });
          }
        } else {
          // No refresh token available or other token error
          return res
            .status(401)
            .json({ message: "Invalid or expired access token" });
        }
      }
    } else if (refreshToken) {
      // Only refresh token provided, not access token
      return res.status(401).json({
        message: "Access token is missing. Please provide both tokens.",
      });
    }
  } catch (error) {
    console.error("Authentication error:", error);
    return res
      .status(500)
      .json({ message: "Internal server error during authentication" });
  }
};

export {
  authentication,
  generateAccessToken,
  generateRefreshToken,
  clearAuthTokens,
};
