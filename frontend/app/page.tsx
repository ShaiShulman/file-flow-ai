"use client";

import { Suspense } from "react";
import FileExplorer from "@/features/file-explorer/components/file-explorer";
import ChatInterface from "@/features/chat/components/chat-interface";
import BottomPanel from "@/components/bottom-panel";
import Toolbar from "@/components/toolbar";
import { Toaster } from "@/components/ui/toaster";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import type { FileType, FolderType } from "@/lib/types";
import { useState } from "react";
import { downloadFolderAsZip } from "@/lib/actions/folder-manager";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<FileType | null>(null);
  const [currentFolder, setCurrentFolder] = useState<FolderType | undefined>(
    undefined
  );
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleFileSelect = (file: FileType) => {
    setSelectedFile(file);
  };

  const handleFilesExtracted = (files: FolderType, folderId: string) => {
    setCurrentFolder(files);
    setCurrentFolderId(folderId);
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);

      if (!currentFolderId) {
        toast({
          title: "No Files Available",
          description: "Please upload files before attempting to download.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Download Started",
        description: "Creating ZIP file...",
      });

      // Get the ZIP file content
      const zipContent = await downloadFolderAsZip(currentFolderId);

      // Create a blob and download it
      const blob = new Blob([zipContent], { type: "application/zip" });
      const url = URL.createObjectURL(blob);

      // Create a temporary download link
      const a = document.createElement("a");
      a.href = url;
      a.download = `fileflow-download-${
        new Date().toISOString().split("T")[0]
      }.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up the URL
      URL.revokeObjectURL(url);

      toast({
        title: "Download Complete",
        description: "Your files have been downloaded successfully.",
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download Failed",
        description:
          error instanceof Error ? error.message : "Failed to download files.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-900">
      <Toolbar
        onFilesExtracted={handleFilesExtracted}
        onDownload={handleDownload}
        isDownloading={isDownloading}
      />
      <div className="flex flex-1 overflow-hidden p-4 gap-4">
        {/* Left side - Chat Interface */}
        <Card className="w-1/2 p-4 flex flex-col h-[calc(100vh-140px)]">
          <Suspense fallback={<div>Loading chat...</div>}>
            <ChatInterface />
          </Suspense>
        </Card>

        {/* Right side - File Explorer and Bottom Panel */}
        <div className="w-1/2 flex flex-col h-[calc(100vh-140px)] gap-4">
          {/* File Explorer */}
          <Card className="flex-1 p-4 overflow-auto">
            <Suspense fallback={<div>Loading files...</div>}>
              <FileExplorer
                onFileSelect={handleFileSelect}
                currentFolder={currentFolder}
              />
            </Suspense>
          </Card>

          {/* Bottom Panel with Tabs */}
          <Card className="h-[300px] p-4 overflow-auto">
            <Suspense fallback={<div>Loading panel...</div>}>
              <BottomPanel selectedFile={selectedFile} />
            </Suspense>
          </Card>
        </div>
      </div>
      <Toaster />
    </main>
  );
}
