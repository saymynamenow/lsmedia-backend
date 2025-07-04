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

// Create a separate multer configuration for ID cards
const idCardStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const idCardDir = path.join(__dirname, "..", "uploads", "idCard");
    if (!fs.existsSync(idCardDir)) {
      fs.mkdirSync(idCardDir, { recursive: true });
      console.log("✅ Multer: Created idCard directory at:", idCardDir);
    }
    console.log("📁 Multer idCard destination:", idCardDir);
    cb(null, idCardDir);
  },
  filename: (req, file, cb) => {
    // Use username as filename with original extension
    const username = req.body.username;
    if (!username) {
      return cb(new Error("Username is required for ID card upload"));
    }
    const filename = username + path.extname(file.originalname);
    console.log("📄 Generated ID card filename:", filename);
    cb(null, filename);
  },
});

// ID card specific file filter
const idCardFileFilter = (req, file, cb) => {
  console.log("🔍 ID card file filter called - MIME type:", file.mimetype);
  if (file.mimetype.startsWith("image/")) {
    console.log("✅ ID card file accepted:", file.originalname);
    cb(null, true);
  } else {
    console.log(
      "❌ ID card file rejected:",
      file.originalname,
      "- Not an image"
    );
    cb(new Error("Only image files are allowed for ID card!"), false);
  }
};

// Create multer instance for ID cards
const uploadIdCard = multer({
  storage: idCardStorage,
  fileFilter: idCardFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for ID cards
  },
});

// Create a separate multer configuration for verification documents
const verificationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const verificationDir = path.join(
      __dirname,
      "..",
      "uploads",
      "verification_documents"
    );
    if (!fs.existsSync(verificationDir)) {
      fs.mkdirSync(verificationDir, { recursive: true });
      console.log(
        "✅ Multer: Created verification_documents directory at:",
        verificationDir
      );
    }
    console.log(
      "📁 Multer verification documents destination:",
      verificationDir
    );
    cb(null, verificationDir);
  },
  filename: (req, file, cb) => {
    // Use userId and timestamp for filename
    const userId = req.user?.userId || "unknown";
    const timestamp = Date.now();
    const uniqueSuffix = Math.round(Math.random() * 1e9);
    const filename = `${userId}_${timestamp}_${uniqueSuffix}${path.extname(
      file.originalname
    )}`;
    console.log("📄 Generated verification document filename:", filename);
    cb(null, filename);
  },
});

// Verification documents file filter (allows images and PDFs)
const verificationFileFilter = (req, file, cb) => {
  console.log("🔍 Verification file filter called - MIME type:", file.mimetype);
  console.log("🔍 Original filename:", file.originalname);

  // Allow images and PDFs
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "application/pdf",
    "image/webp",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    console.log("✅ Verification file accepted:", file.originalname);
    cb(null, true);
  } else {
    console.log(
      "❌ Verification file rejected:",
      file.originalname,
      "- Only images and PDFs are allowed"
    );
    cb(
      new Error(
        "Only image files (JPEG, PNG, GIF, WebP) and PDF files are allowed!"
      ),
      false
    );
  }
};

// Create multer instance for verification documents
const uploadVerificationDocs = multer({
  storage: verificationStorage,
  fileFilter: verificationFileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit for verification documents
    files: 5, // Maximum 5 files
  },
});

export { upload, uploadIdCard, uploadVerificationDocs };
