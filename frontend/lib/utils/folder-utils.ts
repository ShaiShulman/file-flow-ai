"use server";

import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { FolderType, FileType } from "@/lib/types";
import { UPLOAD_BASE_PATH } from "@/lib/const";

async function getFileStats(filePath: string) {
  const stats = await fs.stat(filePath);
  return {
    lastModified: stats.mtime,
    size: stats.size,
  };
}

// Main function to read directory structure from filesystem
export async function readDirectoryStructure(
  dirPath: string,
  parentId?: string
): Promise<FolderType> {
  const dirName = path.basename(dirPath);
  const folder: FolderType = {
    id: parentId || uuidv4(),
    name: dirName,
    type: "folder",
    path: dirPath,
    children: [],
  };

  try {
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
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    // Return empty folder if directory can't be read
  }

  return folder;
}

// Function to rescan folder structure for a given folder ID
export async function rescanFolderStructure(
  folderId: string
): Promise<FolderType | null> {
  console.log("[FOLDER-UTILS] Starting rescan for folder ID:", folderId);

  try {
    const folderName = `extracted_${folderId}`;
    const folderPath = path.join(UPLOAD_BASE_PATH, folderName);

    console.log("[FOLDER-UTILS] Scanning folder path:", folderPath);

    // Check if folder exists
    try {
      await fs.access(folderPath);
      console.log("[FOLDER-UTILS] Folder exists, proceeding with scan");
    } catch {
      console.error("[FOLDER-UTILS] Folder not found:", folderPath);
      return null;
    }

    // Read the updated directory structure
    console.log("[FOLDER-UTILS] Reading directory structure...");
    const updatedStructure = await readDirectoryStructure(folderPath, folderId);
    updatedStructure.name = folderName; // Ensure correct name

    console.log(
      "[FOLDER-UTILS] Directory structure read successfully. Children count:",
      updatedStructure.children.length
    );

    // Save the updated structure
    const structurePath = path.join(
      UPLOAD_BASE_PATH,
      `${folderId}_structure.json`
    );
    await fs.writeFile(
      structurePath,
      JSON.stringify(updatedStructure, null, 2)
    );

    console.log("[FOLDER-UTILS] Structure saved to:", structurePath);
    console.log("[FOLDER-UTILS] Rescan completed successfully");

    return updatedStructure;
  } catch (error) {
    console.error("[FOLDER-UTILS] Error rescanning folder structure:", error);
    return null;
  }
}

// Function to optimize affected files - consolidate child changes to parent folders
export async function optimizeAffectedFiles(
  affectedFiles: string[],
  folderStructure?: FolderType
): Promise<string[]> {
  if (!folderStructure || affectedFiles.length === 0) {
    return affectedFiles;
  }

  console.log("[FOLDER-UTILS] Optimizing affected files:", affectedFiles);

  // Build a map of all file paths in the structure
  const allFilePaths = new Set<string>();
  const folderPaths = new Map<string, string[]>(); // folder path -> array of child file paths

  function walkStructure(item: FolderType | FileType, parentPath = "") {
    const itemPath = parentPath ? `${parentPath}/${item.name}` : item.name;

    if (item.type === "folder") {
      const childPaths: string[] = [];
      folderPaths.set(itemPath, childPaths);

      item.children?.forEach((child) => {
        walkStructure(child, itemPath);
        if (child.type === "file") {
          const childPath = `${itemPath}/${child.name}`;
          allFilePaths.add(childPath);
          childPaths.push(childPath);
        }
      });
    } else {
      allFilePaths.add(itemPath);
    }
  }

  walkStructure(folderStructure);

  // Check each folder to see if ALL its children are affected
  const optimizedFiles = new Set(affectedFiles);

  for (const [folderPath, childFiles] of folderPaths) {
    if (childFiles.length === 0) continue;

    // Check if ALL children of this folder are in the affected files
    const allChildrenAffected = childFiles.every((childPath) =>
      affectedFiles.some(
        (affectedPath) =>
          affectedPath.includes(childPath) || childPath.includes(affectedPath)
      )
    );

    if (allChildrenAffected && childFiles.length > 1) {
      console.log(
        "[FOLDER-UTILS] All children of folder affected, consolidating:",
        folderPath
      );

      // Remove all child files from affected list
      childFiles.forEach((childPath) => {
        affectedFiles.forEach((affectedPath) => {
          if (
            affectedPath.includes(childPath) ||
            childPath.includes(affectedPath)
          ) {
            optimizedFiles.delete(affectedPath);
          }
        });
      });

      // Add the folder instead
      optimizedFiles.add(folderPath);
    }
  }

  const result = Array.from(optimizedFiles);
  console.log("[FOLDER-UTILS] Optimized affected files:", result);

  return result;
}
