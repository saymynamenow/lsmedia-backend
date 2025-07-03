import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ Multer: Created uploads directory at:", uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("📁 Multer destination called for file:", file.fieldname);
    console.log("📂 Saving to directory:", uploadsDir);
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename =
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname);
    console.log("📄 Generated filename:", filename);
    console.log("💾 Full file path:", path.join(uploadsDir, filename));
    cb(null, filename);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  console.log("🔍 File filter called - MIME type:", file.mimetype);
  if (file.mimetype.startsWith("image/")) {
    console.log("✅ File accepted:", file.originalname);
    cb(null, true);
  } else {
    console.log("❌ File rejected:", file.originalname, "- Not an image");
    cb(new Error("Only image files are allowed!"), false);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export { upload };
