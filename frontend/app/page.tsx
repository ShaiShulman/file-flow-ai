"use client";

import { Suspense, useEffect } from "react";
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
import { SessionProvider, useSessionContext } from "@/features/session/context";
import { rescanFolderStructure } from "@/lib/utils/folder-utils";

function HomeContent() {
  const [selectedFile, setSelectedFile] = useState<FileType | null>(null);
  const [currentFolder, setCurrentFolder] = useState<FolderType | undefined>(
    undefined
  );
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Session management from context
  const {
    sessionState,
    createSession,
    updateAffectedFiles: originalUpdateAffectedFiles,
    clearAffectedFiles,
  } = useSessionContext();

  // Wrapper for updateAffectedFiles that optimizes the files
  const updateAffectedFiles = (files: string[]) => {
    console.log("[PAGE] Received affected files:", files);

    // Don't update immediately - let handleFolderStructureChange handle it
    // after the structure is rescanned so paths match properly
    console.log(
      "[PAGE] Deferring affected files update until after structure rescan"
    );
  };

  const handleFileSelect = (file: FileType) => {
    setSelectedFile(file);
  };

  const handleFilesExtracted = (files: FolderType, folderId: string) => {
    setCurrentFolder(files);
    setCurrentFolderId(folderId);
    // Clear affected files when new files are uploaded
    clearAffectedFiles();
  };

  // Handle folder structure changes after agent responses
  const handleFolderStructureChange = async (newAffectedFiles?: string[]) => {
    console.log(
      "[PAGE] handleFolderStructureChange called. Current folder ID:",
      currentFolderId
    );
    console.log("[PAGE] New affected files:", newAffectedFiles);

    if (!currentFolderId) {
      console.log("[PAGE] No current folder ID, skipping rescan");
      return;
    }

    try {
      console.log("[PAGE] Starting folder structure rescan...");
      const updatedStructure = await rescanFolderStructure(currentFolderId);

      if (updatedStructure) {
        console.log(
          "[PAGE] Received updated structure. Setting new currentFolder..."
        );
        console.log(
          "[PAGE] Updated structure children count:",
          updatedStructure.children.length
        );

        setCurrentFolder(updatedStructure);

        // If we have new affected files, update them after the structure is updated
        if (newAffectedFiles) {
          console.log("[PAGE] Updating affected files after structure rescan");
          originalUpdateAffectedFiles(newAffectedFiles);
        }

        console.log("[PAGE] currentFolder state updated successfully");

        toast({
          title: "File Structure Updated",
          description: "The file explorer has been refreshed to show changes",
        });
      } else {
        console.log("[PAGE] No updated structure received from rescan");
      }
    } catch (error) {
      console.error("[PAGE] Failed to rescan folder structure:", error);
      toast({
        title: "Refresh Warning",
        description:
          "Failed to refresh file structure. You may need to reload the page.",
        variant: "destructive",
      });
    }
  };

  // Create session when files are uploaded
  useEffect(() => {
    if (
      currentFolderId &&
      !sessionState.sessionId &&
      !sessionState.isCreating
    ) {
      // Get the working directory path for the uploaded folder
      const workingDirectory = `/uploads/extracted_${currentFolderId}`;
      createSession(currentFolderId, workingDirectory);
    }
  }, [
    currentFolderId,
    sessionState.sessionId,
    sessionState.isCreating,
    createSession,
  ]);

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
            <ChatInterface
              sessionId={sessionState.sessionId}
              workingDirectory={
                currentFolderId
                  ? `/uploads/extracted_${currentFolderId}`
                  : undefined
              }
              updateAffectedFiles={updateAffectedFiles}
              onFolderStructureChange={(affectedFiles) =>
                handleFolderStructureChange(affectedFiles)
              }
            />
          </Suspense>
        </Card>

        {/* Right side - File Explorer and Bottom Panel */}
        <div className="w-1/2 flex flex-col h-[calc(100vh-140px)] gap-4">
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

export default function Home() {
  return (
    <SessionProvider>
      <HomeContent />
    </SessionProvider>
  );
}
