"use client";

import { useState, useEffect } from "react";
import type { FileType, FolderType } from "@/lib/types";
import { sampleData } from "../data";
import FolderItem from "./folder-item";
import { Upload, Folder, FileText } from "lucide-react";
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
        {
          id: "sample-file1",
          name: "document.pdf",
          type: "file",
          path: "/Folder 1/document.pdf",
        },
        {
          id: "sample-file2",
          name: "notes.txt",
          type: "file",
          path: "/Folder 1/notes.txt",
        },
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
            {
              id: "sample-nested-file",
              name: "nested.txt",
              type: "file",
              path: "/Folder 2/subfolder/nested.txt",
            },
          ],
        },
        {
          id: "sample-file3",
          name: "data.json",
          type: "file",
          path: "/Folder 2/data.json",
        },
      ],
    },
    {
      id: "sample-file4",
      name: "readme.md",
      type: "file",
      path: "/readme.md",
    },
    {
      id: "sample-file5",
      name: "config.yml",
      type: "file",
      path: "/config.yml",
    },
  ],
};

interface FileExplorerProps {
  onFileSelect: (file: FileType) => void;
  initialData?: FolderType;
  currentFolder?: FolderType;
}

export default function FileExplorer({
  onFileSelect,
  initialData,
  currentFolder,
}: FileExplorerProps) {
  console.log("[FILE-EXPLORER] Component rendered. Props:", {
    hasInitialData: !!initialData,
    hasCurrentFolder: !!currentFolder,
    currentFolderId: currentFolder?.id,
    currentFolderChildrenCount: currentFolder?.children?.length,
  });

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

  // Expanded folders for sample data (show all expanded)
  const sampleExpandedFolders = new Set([
    "sample-root",
    "sample-folder1",
    "sample-folder2",
    "sample-subfolder",
  ]);

  // Update file system when initialData or currentFolder changes
  useEffect(() => {
    console.log("[FILE-EXPLORER] useEffect triggered. Checking for updates...");
    console.log(
      "[FILE-EXPLORER] currentFolder:",
      currentFolder?.id,
      "children:",
      currentFolder?.children?.length
    );
    console.log(
      "[FILE-EXPLORER] initialData:",
      initialData?.id,
      "children:",
      initialData?.children?.length
    );

    if (currentFolder) {
      console.log(
        "[FILE-EXPLORER] Updating fileSystem with currentFolder:",
        currentFolder.id
      );
      setFileSystem(currentFolder);
      setExpandedFolders(new Set([currentFolder.id]));
      console.log(
        "[FILE-EXPLORER] fileSystem state updated with currentFolder"
      );
    } else if (initialData) {
      console.log(
        "[FILE-EXPLORER] Updating fileSystem with initialData:",
        initialData.id
      );
      setFileSystem(initialData);
      setExpandedFolders(new Set([initialData.id]));
      console.log("[FILE-EXPLORER] fileSystem state updated with initialData");
    } else {
      console.log("[FILE-EXPLORER] No folder data available");
    }
  }, [initialData, currentFolder]);

  // Function to handle file selection
  const handleSelectFile = (file: FileType) => {
    setSelectedFile(file);
    onFileSelect(file);
  };

  // Function to toggle folder expansion
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

  // Dummy handlers for sample data (do nothing)
  const dummyToggleFolder = () => {};
  const dummySelectFile = () => {};

  if (!fileSystem) {
    console.log("[FILE-EXPLORER] Rendering empty state (no fileSystem)");
    return (
      <div className="h-full overflow-hidden relative">
        {/* Centered overlay message - not affected by grayscale */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="p-4 border border-slate-300 rounded-md bg-white shadow-md">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-slate-600" />
              <p className="text-slate-600">Upload zip file to process files</p>
            </div>
          </div>
        </div>

        {/* Greyed out content */}
        <div className="h-full opacity-50 filter grayscale">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">File Structure</h2>
          </div>

          {/* Sample tree structure using FolderItem component */}
          <div className="opacity-30 pointer-events-none filter grayscale">
            <div className="space-y-1">
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
      </div>
    );
  }

  console.log("[FILE-EXPLORER] Rendering file tree. FileSystem:", {
    id: fileSystem.id,
    name: fileSystem.name,
    childrenCount: fileSystem.children.length,
    expandedFoldersCount: expandedFolders.size,
  });

  return (
    <div className="h-full overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">File Structure</h2>
      </div>

      <div className="space-y-1">
        <FolderItem
          folder={fileSystem}
          depth={0}
          expandedFolders={expandedFolders}
          selectedFile={selectedFile}
          onToggleFolder={toggleFolder}
          onSelectFile={handleSelectFile}
        />
      </div>
    </div>
  );
}
