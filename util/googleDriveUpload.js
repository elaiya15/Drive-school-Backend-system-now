import { google } from "googleapis";
import dotenv from "dotenv";
import path from "path";
import stream from "stream";

dotenv.config();

// ✅ Google Auth Configuration
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
 * ✅ Upload a File to Google Drive (Ensuring Only One File Per Category)
 * @param {Object} file - File object from multer (memoryStorage)
 * @param {string} folderId - Google Drive Folder ID
 * @returns {Object} - Uploaded file details (id & webViewLink)
 */
/**
 * ✅ Upload a file to Google Drive (with versioning, no deletion)
 * @param {Object} file - File object from multer (memoryStorage)
 * @param {string} folderId - Google Drive Folder ID
 * @returns {Object} - Uploaded file details (id & webViewLink)
 */
export const uploadAndOverwriteFile = async (file, folderId) => {
  try {
    const fileName = file.originalname; // Keep the original name for versioning

    // 🔍 Step 1: Check if a file with the same name exists in the folder
    const query = `
      '${folderId}' in parents
      and name='${fileName}'
      and trashed=false
    `;
    const existingFiles = await drive.files.list({
      q: query,
      fields: "files(id, name)",
    });

    let fileId = null;
    if (existingFiles.data.files.length > 0) {
      fileId = existingFiles.data.files[0].id; // Get the existing file ID
    }

    // 📤 Step 2: Prepare the file for upload
    const bufferStream = new stream.PassThrough();
    bufferStream.end(file.buffer);

    let uploadedFile;
    if (fileId) {
      // ✅ Overwrite the existing file (Google Drive stores older versions)
      uploadedFile = await drive.files.update({
        fileId,
        media: { mimeType: file.mimetype, body: bufferStream },
        fields: "id, webViewLink",
      });
    } else {
      // ✅ Upload new file if no existing file is found
      uploadedFile = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
        },
        media: { mimeType: file.mimetype, body: bufferStream },
        fields: "id, webViewLink",
      });
    }

    // console.log(`✅ File uploaded: ${fileName} (${uploadedFile.data.webViewLink})`);
    return uploadedFile.data; // Return file details (including Google Drive URL)

  } catch (error) {
    console.error("❌ Error uploading file:", error);
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
    // console.log("Folder Query:", query); // Debugging

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


export const deleteFolderFromDrive = async (folderId) => {
  try {
    if (!folderId) return;

    console.log(`🗑️ Deleting folder: ${folderId}`);

    // Step 1: Get all files inside the subfolder
    const { data } = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name)",
    });

    // Step 2: Delete each file in the subfolder
    if (data.files.length > 0) {
      for (const file of data.files) {
        await drive.files.delete({ fileId: file.id });
        console.log(`🗑️ Deleted file: ${file.name} (${file.id})`);
      }
    }

    // Step 3: Delete the empty subfolder itself
    await drive.files.delete({ fileId: folderId });
    console.log(`✅ Folder Deleted: ${folderId}`);

  } catch (error) {
    console.error("❌ Error deleting folder from Google Drive:", error);
  }
};

//<<<<<<<<<<<<<<<<<<<<<<<uploadInstructorFile>>>>>>>>>>>>>>>>>

                      //uploadInstructorFile
                      
export const uploadInstructorFile = async (file) => {
  try {
    const parentFolderId = process.env.GOOGLE_DRIVE_Instructor_ID; // Main Parent Folder
    const fileName = file.originalname; // Keep the same file name

    console.log("upload-fileName", fileName);

    // 🔍 Step 1: Check if the file already exists
    const query = `'${parentFolderId}' in parents and name='${fileName}' and trashed=false`;
    const existingFiles = await drive.files.list({
      q: query,
      fields: "files(id, name)",
    });

    let uploadedFile;
    const bufferStream = new stream.PassThrough();
    bufferStream.end(file.buffer);

    if (existingFiles.data.files.length > 0) {
      // ✅ Overwrite the existing file (Google Drive keeps older versions)
      const existingFileId = existingFiles.data.files[0].id;

      uploadedFile = await drive.files.update({
        fileId: existingFileId,
        media: { mimeType: file.mimetype, body: bufferStream },
        fields: "id, webViewLink",
      });

      console.log(`✅ File updated: ${fileName} (${uploadedFile.data.webViewLink})`);
    } else {
      // ✅ Upload new file if no existing file is found
      uploadedFile = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [parentFolderId],
        },
        media: { mimeType: file.mimetype, body: bufferStream },
        fields: "id, webViewLink",
      });

      console.log(`✅ File uploaded: ${fileName} (${uploadedFile.data.webViewLink})`);
    }

    return uploadedFile.data; // Return file details (Google Drive URL)
  } catch (error) {
    console.error("❌ Error uploading instructor file:", error);
    throw new Error("Instructor file upload failed");
  }
};

export const deleteInstructorFileFromDrive = async (fileId) => {
  try {
    await drive.files.delete({ fileId });
    console.log(`✅ File deleted: ${fileId}`);
  } catch (error) {
    console.error(`❌ Error deleting file: ${fileId}`, error);
  }
}; 




//<<<<<<<<<<<<<<<<<<<<<<<uploadStaffFile>>>>>>>>>>>>>>>>>

                      //uploadStaffFile 

                      export const uploadStaffFile = async (file) => {
                        try {
                          const parentFolderId = process.env.GOOGLE_DRIVE_Staff_ID; // Main Parent Folder
                          const fileName = file.originalname; // Keep the same file name
                      
                          console.log("upload-fileName", fileName);
                      
                          // 🔍 Step 1: Check if the file already exists
                          const query = `'${parentFolderId}' in parents and name='${fileName}' and trashed=false`;
                          const existingFiles = await drive.files.list({
                            q: query,
                            fields: "files(id, name)",
                          });
                      
                          let uploadedFile;
                          const bufferStream = new stream.PassThrough();
                          bufferStream.end(file.buffer);
                      
                          if (existingFiles.data.files.length > 0) {
                            // ✅ Overwrite the existing file (Google Drive keeps older versions)
                            const existingFileId = existingFiles.data.files[0].id;
                      
                            uploadedFile = await drive.files.update({
                              fileId: existingFileId,
                              media: { mimeType: file.mimetype, body: bufferStream },
                              fields: "id, webViewLink",
                            });
                      
                            console.log(`✅ File updated: ${fileName} (${uploadedFile.data.webViewLink})`);
                          } else {
                            // ✅ Upload new file if no existing file is found
                            uploadedFile = await drive.files.create({
                              requestBody: {
                                name: fileName,
                                parents: [parentFolderId],
                              },
                              media: { mimeType: file.mimetype, body: bufferStream },
                              fields: "id, webViewLink",
                            });
                      
                            console.log(`✅ File uploaded: ${fileName} (${uploadedFile.data.webViewLink})`);
                          }
                      
                          return uploadedFile.data; // Return file details (Google Drive URL)
                        } catch (error) {
                          console.error("❌ Error uploading instructor file:", error);
                          throw new Error("Instructor file upload failed");
                        }
                      };
                      
                      export const deleteStaffFileFromDrive = async (fileId) => {
                        try {
                          await drive.files.delete({ fileId });
                          console.log(`✅ File deleted: ${fileId}`);
                        } catch (error) {
                          console.error(`❌ Error deleting file: ${fileId}`, error);
                        }
                      }; 