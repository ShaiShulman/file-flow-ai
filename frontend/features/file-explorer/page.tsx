"use client";

import { useState } from "react";
import FileExplorer from "./components/file-explorer";
import UploadDialog from "@/features/upload/components/upload-dialog";
import type { FileType, FolderType } from "@/lib/types";

export default function FileExplorerPage() {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<FolderType | undefined>();

  const handleFileSelect = (file: FileType) => {
    // Handle file selection
    console.log("Selected file:", file);
  };

  const handleFilesExtracted = (folderName: string, files: FolderType) => {
    setCurrentFolder(files);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">File Explorer</h1>
        <button
          onClick={() => setIsUploadDialogOpen(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Upload Files
        </button>
      </div>

      <div className="flex-1">
        <FileExplorer
          onFileSelect={handleFileSelect}
          currentFolder={currentFolder}
        />
      </div>

      <UploadDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onFilesExtracted={handleFilesExtracted}
      />
    </div>
  );
}
