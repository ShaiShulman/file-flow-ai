"use server";

import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import type { FolderType, FileType } from "@/lib/types";

// Use an absolute path in the project directory
const UPLOAD_BASE_PATH = path.join(process.cwd(), "uploads");

// Ensure the base upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_BASE_PATH);
  } catch {
    await fs.mkdir(UPLOAD_BASE_PATH, { recursive: true });
  }
}

// Get file statistics (size, last modified)
async function getFileStats(filePath: string) {
  const stats = await fs.stat(filePath);
  return {
    size: stats.size,
    lastModified: stats.mtime,
  };
}

// Recursively read directory structure
async function readDirectoryStructure(
  dirPath: string,
  parentId: string
): Promise<FolderType> {
  const dirName = path.basename(dirPath);
  const folder: FolderType = {
    id: parentId,
    name: dirName,
    type: "folder",
    path: dirPath,
    children: [],
  };

  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const childFolder = await readDirectoryStructure(
        path.join(dirPath, entry.name),
        uuidv4()
      );
      folder.children.push(childFolder);
    } else {
      const fileStats = await getFileStats(path.join(dirPath, entry.name));
      const file: FileType = {
        id: uuidv4(),
        name: entry.name,
        type: "file",
        extension: path.extname(entry.name).slice(1).toLowerCase(),
        path: path.join(dirPath, entry.name),
        metadata: {
          lastModified: fileStats.lastModified,
          size: fileStats.size,
        },
      };
      folder.children.push(file);
    }
  }

  return folder;
}

// Main server action to handle file upload and extraction
export async function uploadAndExtractZip(
  file: File
): Promise<{ folder: FolderType; folderId: string }> {
  try {
    await ensureUploadDir();

    // Create a new folder for extraction
    const folderId = uuidv4();
    const folderName = `extracted_${folderId}`;
    const folderPath = path.join(UPLOAD_BASE_PATH, folderName);

    await fs.mkdir(folderPath, { recursive: true });

    // Process the ZIP file
    const zip = new JSZip();
    const arrayBuffer = await file.arrayBuffer();
    const content = await zip.loadAsync(arrayBuffer);

    const rootFolder: FolderType = {
      id: folderId,
      name: folderName,
      type: "folder",
      path: folderPath,
      children: [],
    };

    const folderMap = new Map<string, FolderType>();
    folderMap.set(folderPath, rootFolder);

    // Process all files in the zip
    for (const [zipPath, zipEntry] of Object.entries(content.files)) {
      const entry = zipEntry as JSZip.JSZipObject;
      if (entry.dir) continue;

      const parts = zipPath.split("/");
      let currentPath = folderPath;

      // Create directory structure
      for (let i = 0; i < parts.length - 1; i++) {
        const dirName = parts[i];
        const parentPath = currentPath;
        currentPath = path.join(currentPath, dirName);

        // Ensure directory exists before proceeding
        try {
          await fs.mkdir(currentPath, { recursive: true });
        } catch (error) {
          console.error(`Failed to create directory ${currentPath}:`, error);
          throw new Error(
            `Failed to create directory structure: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }

        if (!folderMap.has(currentPath)) {
          const dir: FolderType = {
            id: uuidv4(),
            name: dirName,
            type: "folder",
            path: currentPath,
            children: [],
          };

          folderMap.set(currentPath, dir);

          const parent = folderMap.get(parentPath);
          if (parent) {
            parent.children.push(dir);
          }
        }
      }

      // Extract and save the file
      const fileName = parts[parts.length - 1];
      const filePath = path.join(currentPath, fileName);
      const extension = fileName.split(".").pop()?.toLowerCase() || "";

      // Ensure the directory exists before writing the file
      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
      } catch (error) {
        console.error(
          `Failed to create directory for file ${filePath}:`,
          error
        );
        throw new Error(
          `Failed to create directory for file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }

      // Extract the file content
      const fileContent = await entry.async("nodebuffer");
      await fs.writeFile(filePath, fileContent);

      // Add file to its parent directory
      const fileItem: FileType = {
        id: uuidv4(),
        name: fileName,
        type: "file",
        extension,
        path: filePath,
        metadata: {
          lastModified: entry.date,
          size: await entry.async("uint8array").then((data) => data.length),
        },
      };

      const parent = folderMap.get(currentPath);
      if (parent) {
        parent.children.push(fileItem);
      }
    }

    // Save the folder structure
    const structurePath = path.join(
      UPLOAD_BASE_PATH,
      `${folderId}_structure.json`
    );
    await fs.writeFile(structurePath, JSON.stringify(rootFolder, null, 2));

    revalidatePath("/");
    return {
      folder: rootFolder,
      folderId: folderId,
    };
  } catch (error) {
    console.error("Error in uploadAndExtractZip:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to process the uploaded file"
    );
  }
}

// Get all extraction folders
export async function getExtractionFolders() {
  try {
    await ensureUploadDir();

    const metadataPath = path.join(UPLOAD_BASE_PATH, "folders.json");

    try {
      const data = await fs.readFile(metadataPath, "utf-8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  } catch (error) {
    console.error("Error in getExtractionFolders:", error);
    return [];
  }
}

// Get folder structure
export async function getFolderStructure(folderId: string) {
  try {
    await ensureUploadDir();

    const structurePath = path.join(
      UPLOAD_BASE_PATH,
      `${folderId}_structure.json`
    );

    try {
      const data = await fs.readFile(structurePath, "utf-8");
      return JSON.parse(data);
    } catch {
      throw new Error("Folder structure not found");
    }
  } catch (error) {
    console.error("Error in getFolderStructure:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to retrieve folder structure"
    );
  }
}

// Re-zip and download folder structure
export async function downloadFolderAsZip(
  folderId: string
): Promise<Uint8Array> {
  try {
    await ensureUploadDir();

    // Get the folder path directly
    const folderName = `extracted_${folderId}`;
    const folderPath = path.join(UPLOAD_BASE_PATH, folderName);
    console.log("folderPath", folderPath);
    // Check if folder exists
    try {
      await fs.access(folderPath);
    } catch {
      throw new Error("Folder not found");
    }

    // Create a new ZIP file
    const zip = new JSZip();

    // Recursively add files to ZIP from filesystem
    async function addDirectoryToZip(dirPath: string, zipFolder: JSZip) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Create folder in ZIP and recursively add its contents
          const subFolder = zipFolder.folder(entry.name);
          if (subFolder) {
            await addDirectoryToZip(fullPath, subFolder);
          }
        } else {
          // Add file to ZIP
          try {
            const fileContent = await fs.readFile(fullPath);
            zipFolder.file(entry.name, fileContent);
          } catch (error) {
            console.error(`Failed to read file ${fullPath}:`, error);
            // Skip file if it can't be read
          }
        }
      }
    }

    // Add all contents of the extracted folder to the ZIP
    await addDirectoryToZip(folderPath, zip);

    // Generate the ZIP file
    const zipContent = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6,
      },
    });

    return zipContent;
  } catch (error) {
    console.error("Error in downloadFolderAsZip:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to create ZIP file for download"
    );
  }
}

// Get the current folder ID (latest extracted folder)
export async function getCurrentFolderId(): Promise<string | null> {
  try {
    await ensureUploadDir();

    // Get all directories in upload directory
    const entries = await fs.readdir(UPLOAD_BASE_PATH, { withFileTypes: true });

    // Find extracted folders (directories that start with "extracted_")
    const extractedFolders = entries
      .filter(
        (entry) => entry.isDirectory() && entry.name.startsWith("extracted_")
      )
      .map((entry) => {
        // Extract folder ID from folder name (extracted_<folderId>)
        const folderId = entry.name.replace("extracted_", "");
        return { folderId, name: entry.name };
      });

    if (extractedFolders.length === 0) {
      return null;
    }

    // Return the first found folder ID (or you could implement logic to find the most recent)
    // In a real app, you might want to check file modification times to get the most recent
    return extractedFolders[0].folderId;
  } catch (error) {
    console.error("Error in getCurrentFolderId:", error);
    return null;
  }
}
