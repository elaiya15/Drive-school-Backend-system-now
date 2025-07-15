import { google } from "googleapis";
import dotenv from "dotenv";
import path from "path";
import stream from "stream";

dotenv.config();

// ✅ Google Auth Configuration
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(process.cwd(), "util/service-account.json"),
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});

const drive = google.drive({ version: "v3", auth });

/**
 * ✅ Create a Folder in Google Drive
 * @param {string} folderName - The name of the folder
 * @returns {string} folderId - The created folder ID
 */
export const createDriveFolder = async (folderName) => {
  try {
    const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID; // Main Folder ID
    const response = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      },
      fields: "id",
    });
    return response.data.id;
  } catch (error) {
    console.error("Error creating folder:", error);
    throw new Error("Failed to create folder");
  }
};

/**
 * ✅ Find a File in Google Drive (By Name Inside a Folder)
 * @param {string} fileName - The name of the file
 * @param {string} folderId - The Google Drive folder ID
 * @returns {string|null} - The file ID if found, otherwise null
 */
export const findFileInDrive = async (fileName, folderId) => {
  try {
    const query = `'${folderId}' in parents and name='${fileName}' and trashed=false`;
    console.log("Drive Query:", query); // Debugging

    const response = await drive.files.list({
      q: query,
      fields: "files(id, name)",
    });

    if (response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    return null; // File not found
  } catch (error) {
    console.error("Error finding file in Drive:", error);
    return null;
  }
};

/**
 * ✅ Upload a File to Google Drive (Update If Exists)
 * @param {Object} file - File object from multer (memoryStorage)
 * @param {string} folderId - Google Drive Folder ID
 * @param {string} admissionNumber - Unique admission number for renaming
 * @returns {Object} - Uploaded file details (id & webViewLink)
 */

export const uploadAndOverwriteFile = async (file, folderId) => {
  try {
    const newFileName = file.originalname; // ✅ Use the name set in update method

    // 🔍 Step 1: Check if the file already exists in the learner's folder
    const existingFileId = await findFileInDrive(newFileName, folderId);

    // 📤 Step 2: Prepare file for upload
    const bufferStream = new stream.PassThrough();
    bufferStream.end(file.buffer);

    let uploadedFile;
    if (existingFileId) {
      // ✅ File exists: Overwrite the existing file (Google Drive versioning)
      uploadedFile = await drive.files.update({
        fileId: existingFileId,
        media: { mimeType: file.mimetype, body: bufferStream },
        fields: "id, webViewLink",
      });
    } else {
      // 📌 File does not exist: Upload as a new file in the learner's folder
      uploadedFile = await drive.files.create({
        requestBody: { name: newFileName, parents: [folderId] },
        media: { mimeType: file.mimetype, body: bufferStream },
        fields: "id, webViewLink",
      });
    }

    return uploadedFile.data;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw new Error("File upload failed");
  }
};



/**
 * ✅ Find Learner's Folder in Google Drive (Using admissionNumber)
 * @param {string} admissionNumber - Learner's unique admission number
 * @returns {string|null} - Folder ID if found, otherwise null
 */
export const findLearnerFolderInDrive = async (admissionNumber) => {
  try {
    const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID; // Main Folder ID

    const query = `'${parentFolderId}' in parents and name='${admissionNumber}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    console.log("Folder Query:", query); // Debugging

    const response = await drive.files.list({
      q: query,
      fields: "files(id, name)",
    });

    if (response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    return null; // Folder not found
  } catch (error) {
    console.error("Error finding learner folder in Drive:", error);
    return null;
  }
};



// ✅ Get all tests using MongoDB Aggregation
export const getAllTests = async (req, res) => {
  try {
    const { testType, result, gender } = req.query;
    
    const search = req.query.search ? req.query.search.trim() : "";

    let page = parseInt(req.query.page, 10);
    page = isNaN(page) || page < 1 ? 1 : page;

    let limit = parseInt(req.query.limit, 10);
    limit = isNaN(limit) || limit < 1 ? 15 : limit;

    const fromdate = req.query.fromdate || null;
    const todate = req.query.todate || null;

    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 15;
    const skip = (pageNumber - 1) * limitNumber;

    console.log("🔍 Received Search Query:", search);
    console.log("📆 Date Range:", { fromdate, todate });

    let searchDate = null;
    if (!isNaN(Date.parse(search))) {
      searchDate = new Date(search);
    }

    const trimmedSearch = search.trim().replace(/([a-z])([A-Z])/g, "$1.*$2").replace(/\s+/g, ".*");

    let matchFilter = {};

    // ✅ Ensure exact matches for `testType`, `result`, and `gender`
   // Function to normalize spaces in string filters
   const normalizeFilter = (value) => {
    if (!value) return null;
    const normalized = value.replace(/\s+/g, ""); // Remove all spaces
    return { $regex: `^${normalized.replace(/(.{1})/g, "$1\\s*")}$`, $options: "i" }; // Allow flexible spacing
    };
  
  if (testType) matchFilter.testType = normalizeFilter(testType);
  if (result) matchFilter.result = normalizeFilter(result);
  if (gender) matchFilter["learner.gender"] = normalizeFilter(gender);

    
    // ✅ Apply search filters
    matchFilter.$or = [
      { "learner.fullName": { $regex: trimmedSearch, $options: "i" } },
      { "learner.fathersName": { $regex: trimmedSearch, $options: "i" } },
      { "learner.mobileNumber": { $regex: trimmedSearch, $options: "i" } },
      { "learner.licenseNumber": { $regex: trimmedSearch, $options: "i" } },
      { "learner.llrNumber": { $regex: trimmedSearch, $options: "i" } },
      { "learner.admissionNumber": { $regex: `^\\s*${trimmedSearch}\\s*$`, $options: "i" } },
      { testType: { $regex: trimmedSearch, $options: "i" } },
      { result: { $regex: trimmedSearch, $options: "i" } },
      ...(searchDate
        ? [
            { createdAt: { $gte: searchDate, $lt: new Date(searchDate.getTime() + 86400000) } },
            { updatedAt: { $gte: searchDate, $lt: new Date(searchDate.getTime() + 86400000) } },
            { date: { $gte: searchDate, $lt: new Date(searchDate.getTime() + 86400000) } },
          ]
        : []),
    ];

    // ✅ Date range filter
    if (fromdate || todate) {
      matchFilter.$and = [
        ...(matchFilter.$and || []), // Preserve previous filters
        {
          date: {
            ...(fromdate ? { $gte: new Date(`${fromdate}T00:00:00.000Z`) } : {}),
            ...(todate ? { $lte: new Date(`${todate}T23:59:59.999Z`) } : {}),
          },
        },
      ];
    }

    const pipeline = [
      {
        $lookup: {
          from: "learners",
          localField: "learnerId",
          foreignField: "_id",
          as: "learner",
        },
      },
      { $unwind: "$learner" },
      { $match: matchFilter }, // ✅ Now `testType` & `result` filters will work
      {
        $project: {
          learnerId: 0,
          "__v": 0,
          "learner.__v": 0,
        },
      },
      {
        $facet: {
          metadata: [{ $count: "totalTests" }],
          data: [{ $skip: skip }, { $limit: limitNumber }],
        },
      },
    ];

    const results = await Test.aggregate(pipeline);
    const tests = results[0].data || [];
    const totalTests = results[0].metadata[0] ? results[0].metadata[0].totalTests : 0;
    const totalPages = Math.ceil(totalTests / limitNumber);

    console.log("📊 Total Tests Found:", totalTests);

    res.status(200).json({
      success: true,
      totalPages,
      currentPage: pageNumber,
      totalTests,
      tests,
    });
  } catch (error) {
    console.error("❌ Error Fetching Tests:", error);
    res.status(500).json({ success: false, message: "Error fetching tests", error: error.message });
  }
};