"use client";

import { useState, useEffect } from "react";
import type { FileType, FolderType } from "@/lib/types";
import FolderItem from "./folder-item";
import FileItem from "./file-item";
import { Upload } from "lucide-react";
import { useSessionContext } from "@/features/session/context";

// Sample data constant for empty state
const SAMPLE_DATA: FolderType = {
  id: "sample-root",
  name: "Project Files",
  type: "folder",
  path: "/",
  children: [
    {
      id: "sample-folder1",
      name: "Folder 1",
      type: "folder",
      path: "/Folder 1",
      children: [
        { id: "sample-file1", name: "document.pdf", type: "file", path: "/Folder 1/document.pdf" },
        { id: "sample-file2", name: "notes.txt", type: "file", path: "/Folder 1/notes.txt" },
      ],
    },
    {
      id: "sample-folder2",
      name: "Folder 2",
      type: "folder",
      path: "/Folder 2",
      children: [
        {
          id: "sample-subfolder",
          name: "subfolder",
          type: "folder",
          path: "/Folder 2/subfolder",
          children: [
            { id: "sample-nested-file", name: "nested.txt", type: "file", path: "/Folder 2/subfolder/nested.txt" },
          ],
        },
        { id: "sample-file3", name: "data.json", type: "file", path: "/Folder 2/data.json" },
      ],
    },
    { id: "sample-file4", name: "readme.md", type: "file", path: "/readme.md" },
    { id: "sample-file5", name: "config.yml", type: "file", path: "/config.yml" },
  ],
};

interface FileExplorerProps {
  onFileSelect: (file: FileType) => void;
  initialData?: FolderType;
  currentFolder?: FolderType;
  fileChangeTypes?: Record<string, string>;
  allFileMetadata?: Record<string, Record<string, any>>;
}

export default function FileExplorer({
  onFileSelect,
  initialData,
  currentFolder,
  fileChangeTypes = {},
  allFileMetadata = {},
}: FileExplorerProps) {
  const [fileSystem, setFileSystem] = useState<FolderType | null>(
    initialData || null
  );
  const [selectedFile, setSelectedFile] = useState<FileType | undefined>(
    undefined
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["root"])
  );

  // Get affected files from session context
  const { sessionState } = useSessionContext();
  const affectedFiles = sessionState.affectedFiles;
  const recentlyAffectedFiles = sessionState.recentlyAffectedFiles;

  // Expanded folders for sample data (show all expanded)
  const sampleExpandedFolders = new Set([
    "sample-root",
    "sample-folder1",
    "sample-folder2",
    "sample-subfolder",
  ]);

  // Update file system when initialData or currentFolder changes
  useEffect(() => {
    if (currentFolder) {
      setFileSystem(currentFolder);
      // Auto-expand all top-level folders
      const topLevelFolderIds = currentFolder.children
        .filter((c) => c.type === "folder")
        .map((c) => c.id);
      setExpandedFolders(new Set([currentFolder.id, ...topLevelFolderIds]));
    } else if (initialData) {
      setFileSystem(initialData);
      const topLevelFolderIds = initialData.children
        .filter((c) => c.type === "folder")
        .map((c) => c.id);
      setExpandedFolders(new Set([initialData.id, ...topLevelFolderIds]));
    }
  }, [initialData, currentFolder]);

  const handleSelectFile = (file: FileType) => {
    setSelectedFile(file);
    onFileSelect(file);
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const dummyToggleFolder = () => {};
  const dummySelectFile = () => {};

  // Extract filename from a path (handles both / and \ separators)
  const getFileName = (p: string) => p.split(/[\\/]/).pop() || p;

  // Helper to get change type for a file
  const getChangeType = (name: string, path?: string): string | undefined => {
    if (path && fileChangeTypes[path]) return fileChangeTypes[path];
    if (fileChangeTypes[name]) return fileChangeTypes[name];
    for (const [key, value] of Object.entries(fileChangeTypes)) {
      const keyName = getFileName(key);
      if (keyName === name) return value;
    }
    return undefined;
  };

  if (!fileSystem) {
    return (
      <div className="h-full overflow-hidden relative">
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="p-4 border border-stone-200 rounded-md bg-white shadow-md">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-stone-500" />
              <p className="text-stone-500">Upload zip file to process files</p>
            </div>
          </div>
        </div>

        <div className="h-full opacity-50 filter grayscale">
          <div className="opacity-30 pointer-events-none filter grayscale">
            <FolderItem
              folder={SAMPLE_DATA}
              depth={0}
              expandedFolders={sampleExpandedFolders}
              selectedFile={undefined}
              onToggleFolder={dummyToggleFolder}
              onSelectFile={dummySelectFile}
            />
          </div>
        </div>
      </div>
    );
  }

  // Render children directly (skip root folder)
  return (
    <div className="h-full overflow-auto">
      {fileSystem.children.map((child) => {
        if (child.type === "folder") {
          return (
            <FolderItem
              key={child.id}
              folder={child}
              depth={0}
              expandedFolders={expandedFolders}
              selectedFile={selectedFile}
              onToggleFolder={toggleFolder}
              onSelectFile={handleSelectFile}
              fileChangeTypes={fileChangeTypes}
              allFileMetadata={allFileMetadata}
            />
          );
        } else {
          const isAffected = affectedFiles.some((p) => {
            const affectedName = getFileName(p);
            return affectedName === child.name || p === child.name || (child.path && p === child.path);
          });
          const changeType = getChangeType(child.name, child.path);
          const fileMeta = allFileMetadata[child.path] || allFileMetadata[child.name];
          const isRecentlyAffected = recentlyAffectedFiles.some((p) => {
            const recentName = getFileName(p);
            return recentName === child.name || p === child.name || (child.path && p === child.path);
          });

          return (
            <FileItem
              key={child.id}
              file={child}
              isSelected={selectedFile?.id === child.id}
              paddingLeft={8}
              onSelect={handleSelectFile}
              isAffected={isAffected}
              changeType={changeType}
              fileMetadata={fileMeta}
              isRecentlyAffected={isRecentlyAffected}
            />
          );
        }
      })}
    </div>
  );
}
