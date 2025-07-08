import express from "express";
import cookieParser from "cookie-parser";
import env from "./config/dotenv.js";
import compression from "compression";
import { authenticationRoute } from "./Route/authenticationRoute.js";
import { authentication } from "./middleware/authenticantion.js";
import { userRoute } from "./Route/usersRoute.js";
import { postsRouter } from "./Route/postsRouter.js";
import { likeRouter } from "./Route/likeRouting.js";
import cors from "cors";
import { commentRouter } from "./Route/commentRoute.js";
import { friendshipRoute } from "./Route/friendshipRoute.js";
import { sponsoredRouter } from "./Route/sponsoredRoute.js";
import { pageRoute } from "./Route/pageRoute.js";
import { notificationRouter } from "./Route/notificationRoute.js";
import { searchRouter } from "./Route/searchRoute.js";
import { verificationRoute } from "./Route/verificationRoute.js";
import { boostedPostRouter } from "./Route/boostedPostRoute.js";
import reportRouter from "./Route/reportRoute.js";

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log("✅ Created uploads directory at:", uploadsPath);
} else {
  console.log("✅ Uploads directory exists at:", uploadsPath);
}

// List files in uploads directory for debugging
try {
  const files = fs.readdirSync(uploadsPath);
  console.log(
    "📁 Files in uploads directory:",
    files.length > 0 ? files : "No files found"
  );
} catch (error) {
  console.error("❌ Error reading uploads directory:", error.message);
}

const allowedOrigins = [
  "https://media.fiqrianandahakin.my.id",
  "http://localhost:5173",
];
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authenticationRoute);
app.use("/api/users", authentication, userRoute);
app.use("/api/posts", authentication, postsRouter);
app.use("/api/like", authentication, likeRouter);
app.use("/api/comment/", authentication, commentRouter);
app.use("/api/friendship", authentication, friendshipRoute);
app.use("/api/sponsored", authentication, sponsoredRouter);
app.use("/api/page", authentication, pageRoute);
app.use("/api/notifications", authentication, notificationRouter);
app.use("/api/search", authentication, searchRouter);
app.use("/api/verification", authentication, verificationRoute);
app.use("/api/boosted-posts", authentication, boostedPostRouter);
app.use("/api/reports", authentication, reportRouter);

app.listen(env.DEV_PORT, () => {
  console.log(`🚀 Server is running on port ${env.DEV_PORT}`);
});
