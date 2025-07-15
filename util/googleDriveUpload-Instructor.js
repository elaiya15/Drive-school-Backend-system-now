import { google } from "googleapis";
import dotenv from "dotenv";
import path from "path";
import stream from "stream";
import { v4 as uuidv4 } from "uuid"; // Generate unique IDs

dotenv.config();

// const auth = new google.auth.GoogleAuth({
//   keyFile: path.join(process.cwd(), "util/service-account.json"),
//   scopes: ["https://www.googleapis.com/auth/drive.file"],
// });

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  ["https://www.googleapis.com/auth/drive.file"] // ✅ allows file upload + create
);

const drive = google.drive({ version: "v3", auth });

/**
 * ✅ Upload Instructor File (Stores Each Upload as a New File)
 * @param {Object} file - File object from multer (memoryStorage)
 * @returns {Object} - Uploaded file details (id & webViewLink)
 */
export const uploadInstructorFile = async (file) => {
  try {
    const parentFolderId =process.env.GOOGLE_DRIVE_Instructor_ID; // Main Parent Folder
    const fileName = file.originalname; // Example: photo_67e82c96a5f3.jpg

    console.log("upload-fileName",fileName);
    
    // 📤 Prepare file for upload
    const bufferStream = new stream.PassThrough();
    bufferStream.end(file.buffer);

    const uploadedFile = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [parentFolderId],
      },
      media: { mimeType: file.mimetype, body: bufferStream },
      fields: "id, webViewLink",
    });

    return uploadedFile.data; // Return file details (Google Drive URL)
  } catch (error) {
    console.error("❌ Error uploading instructor file:", error);
    throw new Error("Instructor file upload failed");
  }
};
