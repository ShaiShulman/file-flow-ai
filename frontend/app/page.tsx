"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import FileExplorer from "@/features/file-explorer/components/file-explorer";
import ChatInterface from "@/features/chat/components/chat-interface";
import UnifiedInfoPanel from "@/components/unified-info-panel";
import Toolbar from "@/components/toolbar";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/components/ui/use-toast";
import type { FileType, FolderType, ActionRecord, FileReference } from "@/lib/types";
import { downloadFolderAsZip } from "@/lib/actions/folder-manager";
import { SessionProvider, useSessionContext } from "@/features/session/context";
import { rescanFolderStructure } from "@/lib/utils/folder-utils";
import { apiClient, type AgentResponse } from "@/features/api/client";
import ExportDialog from "@/features/export/components/export-dialog";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

function findFileInTree(folder: FolderType, name: string): FileType | null {
  for (const child of folder.children) {
    if (child.type === "file" && child.name === name) return child;
    if (child.type === "folder") {
      const found = findFileInTree(child, name);
      if (found) return found;
    }
  }
  return null;
}

function HomeContent() {
  const [selectedFile, setSelectedFile] = useState<FileType | null>(null);
  const [currentFolder, setCurrentFolder] = useState<FolderType | undefined>(
    undefined
  );
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const restoredRef = useRef(false);
  const addRevertMessageRef = useRef<((content: string) => void) | null>(null);
  const addUserActionMessageRef = useRef<((content: string) => void) | null>(null);
  const insertFileBadgeRef = useRef<((fileRef: FileReference, isFolder?: boolean) => void) | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Session management from context
  const {
    sessionState,
    createSession,
    restoreSession,
    updateAffectedFiles: originalUpdateAffectedFiles,
    clearAffectedFiles,
    clearRecentlyAffectedFiles,
    updateFileChangeTypes,
    updateAllFileMetadata,
  } = useSessionContext();

  // Restore session from URL parameter on mount
  useEffect(() => {
    const urlSessionId = searchParams.get("session");
    if (urlSessionId && !sessionState.sessionId && !sessionState.isCreating && !restoredRef.current) {
      restoredRef.current = true;
      setIsRestoring(true);

      (async () => {
        try {
          // Restore session state (fileChangeTypes, allFileMetadata)
          const workingDirectory = await restoreSession(urlSessionId);

          // Extract folderId from working directory (e.g., "uploads/extracted_{folderId}")
          const match = workingDirectory.match(/extracted_(.+)$/);
          const folderId = match ? match[1] : urlSessionId;

          // Ensure backend agent is alive (idempotent create)
          await apiClient.createSession(folderId, workingDirectory);

          // Fetch folder structure from backend (stable IDs) with fallback to local scan
          let folderStructure;
          try {
            folderStructure = await apiClient.getFolderStructure(folderId);
          } catch {
            folderStructure = await rescanFolderStructure(folderId);
          }
          if (folderStructure) {
            setCurrentFolder(folderStructure);
            setCurrentFolderId(folderId);
          }
        } catch {
          // Session not found or restoration failed — clear URL param
          router.replace("/");
          toast({
            title: "Session Not Found",
            description: "The session could not be restored. It may have been deleted.",
            variant: "destructive",
          });
        } finally {
          setIsRestoring(false);
        }
      })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync URL with session state
  useEffect(() => {
    if (isRestoring) return;

    const currentUrlSession = searchParams.get("session");
    if (sessionState.sessionId) {
      if (currentUrlSession !== sessionState.sessionId) {
        router.replace(`?session=${sessionState.sessionId}`);
      }
    } else if (currentUrlSession) {
      router.replace("/");
    }
  }, [sessionState.sessionId, isRestoring, searchParams, router]);

  // Wrapper for updateAffectedFiles — clears old highlights before setting new ones
  const updateAffectedFiles = (files: string[], lastAffectedFiles?: string[]) => {
    clearRecentlyAffectedFiles();
    originalUpdateAffectedFiles(files, lastAffectedFiles);
  };

  // Handle actions and metadata from agent responses for file explorer indicators
  const handleResponseData = (data: {
    actions: Array<Record<string, any>>;
    file_metadata: Record<string, any>;
    file_id_map?: Record<string, string>;
  }) => {
    const fileIdMap = data.file_id_map || {};
    const changeTypes: Record<string, string> = {};

    for (const action of data.actions) {
      const actionType = action.action_type || "";
      if (!actionType) continue;

      // Try to resolve a stable file ID for this action
      const actionPath = action.target_path || action.source_path || "";
      const fileId = fileIdMap[actionPath];
      if (fileId) {
        changeTypes[fileId] = actionType;
      } else {
        // Fallback: use path/name for backwards compatibility
        const path = action.item_path || action.item_name || "";
        if (path) changeTypes[path] = actionType;
      }
    }

    // Mark metadata-only changes as "analyze" type, keyed by file ID when possible
    for (const filePath of Object.keys(data.file_metadata)) {
      const fileId = fileIdMap[filePath];
      const key = fileId || filePath;
      if (!changeTypes[key]) {
        changeTypes[key] = "analyze";
      }
    }

    if (Object.keys(changeTypes).length > 0) {
      updateFileChangeTypes(changeTypes);
    }

    // Store metadata keyed by file ID when available
    const idKeyedMetadata: Record<string, Record<string, any>> = {};
    for (const [filePath, meta] of Object.entries(data.file_metadata)) {
      const fileId = fileIdMap[filePath];
      if (fileId) {
        idKeyedMetadata[fileId] = meta as Record<string, any>;
      }
      // Also keep path-keyed for backwards compatibility
      idKeyedMetadata[filePath] = meta as Record<string, any>;
    }

    if (Object.keys(idKeyedMetadata).length > 0) {
      updateAllFileMetadata(idKeyedMetadata);
    }
  };

  const handleFileSelect = (file: FileType) => {
    setSelectedFile(file);
  };

  const handleFileSelectByName = (fileName: string) => {
    if (currentFolder) {
      const file = findFileInTree(currentFolder, fileName);
      if (file) {
        setSelectedFile(file);
      }
    }
  };

  const handleChatReady = useCallback((callbacks: {
    addRevertMessage: (content: string) => void;
    addUserActionMessage: (content: string) => void;
    insertFileBadge: (fileRef: FileReference, isFolder?: boolean) => void;
  }) => {
    addRevertMessageRef.current = callbacks.addRevertMessage;
    addUserActionMessageRef.current = callbacks.addUserActionMessage;
    insertFileBadgeRef.current = callbacks.insertFileBadge;
  }, []);

  const handleFilesExtracted = (files: FolderType, folderId: string) => {
    setCurrentFolder(files);
    setCurrentFolderId(folderId);
    clearAffectedFiles();
  };

  const handleFolderStructureChange = async (newAffectedFiles?: string[], lastAffectedFiles?: string[]) => {
    if (!currentFolderId) return;

    try {
      // Prefer backend API for folder structure (stable IDs)
      let updatedStructure: FolderType | null = null;
      if (sessionState.sessionId) {
        try {
          updatedStructure = await apiClient.getFolderStructure(sessionState.sessionId);
        } catch {
          // Backend unavailable, fall back to filesystem scan
          console.warn("Backend folder-structure unavailable, falling back to local rescan");
        }
      }
      if (!updatedStructure) {
        updatedStructure = await rescanFolderStructure(currentFolderId);
      }

      if (updatedStructure) {
        setCurrentFolder(updatedStructure);

        // Re-trigger recentlyAffectedFiles AFTER the tree is updated,
        // so the highlight timer starts when the new files are actually rendered
        if (lastAffectedFiles && lastAffectedFiles.length > 0) {
          originalUpdateAffectedFiles(
            sessionState.affectedFiles.length > 0 ? sessionState.affectedFiles : (newAffectedFiles ?? []),
            lastAffectedFiles
          );
        }
      }
    } catch (error) {
      console.error("Failed to rescan folder structure:", error);
      toast({
        title: "Refresh Warning",
        description: "Failed to refresh file structure. You may need to reload the page.",
        variant: "destructive",
      });
    }
  };

  const handleRevertSuccess = useCallback((_action: ActionRecord, revertMessage: string) => {
    // Show revert notification in chat
    if (addRevertMessageRef.current) {
      addRevertMessageRef.current(revertMessage);
    }
    // Refresh folder structure
    handleFolderStructureChange();
  }, [handleFolderStructureChange]);

  // Manual file action handlers
  const handleDeleteItem = useCallback(async (path: string, name: string, itemType: "file" | "folder") => {
    if (!sessionState.sessionId) return;
    try {
      await apiClient.deleteFile(sessionState.sessionId, path, itemType);
      addUserActionMessageRef.current?.(`Deleted ${itemType === "folder" ? "folder" : ""} '${name}'`);
      updateFileChangeTypes({ [path]: itemType === "folder" ? "delete_folder" : "delete_file" });
      handleFolderStructureChange();
      toast({ title: "Deleted", description: `${name} has been deleted` });
    } catch (error) {
      toast({ title: "Delete Failed", description: error instanceof Error ? error.message : "Failed to delete item", variant: "destructive" });
    }
  }, [sessionState.sessionId, handleFolderStructureChange, updateFileChangeTypes, toast]);

  const handleMoveItem = useCallback(async (sourcePath: string, destPath: string, name: string) => {
    if (!sessionState.sessionId) return;
    try {
      await apiClient.moveFile(sessionState.sessionId, sourcePath, destPath);
      const destName = destPath.split("/").filter(Boolean).pop() || "root";
      addUserActionMessageRef.current?.(`Moved '${name}' to '${destName}'`);
      updateFileChangeTypes({ [sourcePath]: "move_file" });
      handleFolderStructureChange();
      toast({ title: "Moved", description: `${name} has been moved` });
    } catch (error) {
      toast({ title: "Move Failed", description: error instanceof Error ? error.message : "Failed to move item", variant: "destructive" });
    }
  }, [sessionState.sessionId, handleFolderStructureChange, updateFileChangeTypes, toast]);

  const handleCreateFolder = useCallback(async (name: string, parentPath?: string) => {
    if (!sessionState.sessionId) return;
    try {
      await apiClient.createFolder(sessionState.sessionId, name, parentPath);
      addUserActionMessageRef.current?.(`Created folder '${name}'`);
      handleFolderStructureChange();
      toast({ title: "Folder Created", description: `'${name}' has been created` });
    } catch (error) {
      toast({ title: "Create Failed", description: error instanceof Error ? error.message : "Failed to create folder", variant: "destructive" });
    }
  }, [sessionState.sessionId, handleFolderStructureChange, toast]);

  const handleAddToChat = useCallback((fileRef: FileReference, isFolder?: boolean) => {
    insertFileBadgeRef.current?.(fileRef, isFolder);
  }, []);

  // Create session when files are uploaded
  useEffect(() => {
    if (currentFolderId && !sessionState.sessionId && !sessionState.isCreating) {
      const workingDirectory = `/uploads/extracted_${currentFolderId}`;
      createSession(currentFolderId, workingDirectory).catch(() => {
        // Error already handled via toast in createSession
      });
    }
  }, [currentFolderId, sessionState.sessionId, sessionState.isCreating, createSession]);

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

      toast({ title: "Download Started", description: "Creating ZIP file..." });

      const zipContent = await downloadFolderAsZip(currentFolderId, sessionState.sessionId);
      const blob = new Blob([zipContent as Uint8Array<ArrayBuffer>], { type: "application/zip" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `fileflow-download-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Download Complete", description: "Your files have been downloaded successfully." });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download files.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <main className="flex h-screen flex-col bg-stone-50 dark:bg-stone-900 overflow-hidden">
      <Toolbar
        onFilesExtracted={handleFilesExtracted}
        onDownload={handleDownload}
        isDownloading={isDownloading}
        onExport={() => setIsExportOpen(true)}
        hasSession={!!sessionState.sessionId}
      />

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-52px)]">
          {/* Left: Chat */}
          <ResizablePanel defaultSize={45} minSize={25} className="p-3">
            <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading chat...</div>}>
              <ChatInterface
                sessionId={sessionState.sessionId}
                workingDirectory={
                  currentFolderId ? `/uploads/extracted_${currentFolderId}` : undefined
                }
                updateAffectedFiles={updateAffectedFiles}
                onFolderStructureChange={(affectedFiles, lastAffectedFiles) =>
                  handleFolderStructureChange(affectedFiles, lastAffectedFiles)
                }
                onResponseData={handleResponseData}
                onFileSelect={handleFileSelectByName}
                onChatReady={handleChatReady}
              />
            </Suspense>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: File Explorer + Unified Info Panel */}
          <ResizablePanel defaultSize={55} minSize={30}>
            <ResizablePanelGroup direction="vertical">
              {/* File Explorer */}
              <ResizablePanel defaultSize={45} minSize={15} className="p-2 overflow-hidden">
                <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading files...</div>}>
                  <FileExplorer
                    onFileSelect={handleFileSelect}
                    currentFolder={currentFolder}
                    fileChangeTypes={sessionState.fileChangeTypes}
                    allFileMetadata={sessionState.allFileMetadata}
                    onDeleteItem={handleDeleteItem}
                    onMoveItem={handleMoveItem}
                    onCreateFolder={handleCreateFolder}
                    onAddToChat={handleAddToChat}
                  />
                </Suspense>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Unified Info Panel (File Details + Session Info) */}
              <ResizablePanel defaultSize={55} minSize={20} className="overflow-hidden">
                <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>}>
                  <UnifiedInfoPanel selectedFile={selectedFile} sessionId={sessionState.sessionId} onRevertSuccess={handleRevertSuccess} />
                </Suspense>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <ExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        sessionId={sessionState.sessionId}
      />
      <Toaster />
    </main>
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>}>
        <HomeContent />
      </Suspense>
    </SessionProvider>
  );
}
