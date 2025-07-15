import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const router = express.Router();

// ✅ Google Drive Auth Setup
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(process.cwd(), "util/service-account.json"),
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });

// ✅ GET /api/image-proxy/:fileId → Stream the file
router.get("/:fileId", async (req, res) => {
  const { fileId } = req.params;

  if (!fileId) {
    return res.status(400).json({ error: "Missing fileId" });
  }

  try {
    // 1. Get file metadata
    const metaRes = await drive.files.get({
      fileId,
      fields: "mimeType, name",
    });

    const mimeType = metaRes.data.mimeType || "application/octet-stream";
    const fileName = metaRes.data.name || "file";
    const isPDF = mimeType === "application/pdf" || mimeType.includes("pdf");
    const isImage = mimeType.startsWith("image/");

    let fileType = "unknown";
    if (isImage) fileType = "image";
    else if (isPDF) fileType = "pdf";

    // 2. Get actual file stream
    const fileStream = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    // 3. Set headers
    res.setHeader("Content-Type", mimeType);
    res.setHeader("X-File-Type", fileType);
    res.setHeader("X-File-Name", encodeURIComponent(fileName));
    res.setHeader("Access-Control-Expose-Headers", "X-File-Type, X-File-Name");

    const origin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (isPDF) {
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    }

    // 4. Stream the file
    fileStream.data.pipe(res);
  } catch (error) {
    console.error("Drive proxy error:", error.message);
    res.status(500).json({
      message: "Failed to retrieve file",
      error: error.message,
    });
  }
});

// ✅ POST /api/image-proxy/file-types → Batch detect file types
router.post("/file-types", async (req, res) => {
  const { fileIds } = req.body;

  if (!Array.isArray(fileIds)) {
    return res.status(400).json({ error: "fileIds must be an array" });
  }

  try {
    const results = await Promise.all(
      fileIds.map(async (fileId) => {
        try {
          const meta = await drive.files.get({
            fileId,
            fields: "mimeType",
          });

          const mimeType = meta.data.mimeType || "";
          const isPDF = mimeType === "application/pdf" || mimeType.includes("pdf");
          const isImage = mimeType.startsWith("image/");

          let fileType = "unknown";
          if (isImage) fileType = "image";
          else if (isPDF) fileType = "pdf";

          return { fileId, fileType };
        } catch (err) {
          console.error(`Failed to fetch file type for ${fileId}:`, err.message);
          return { fileId, fileType: "unknown", error: err.message };
        }
      })
    );

    res.json({ results });
  } catch (err) {
    console.error("Batch type fetch error:", err.message);
    res.status(500).json({ message: "Batch file type fetch failed", error: err.message });
  }
});

export default router;
