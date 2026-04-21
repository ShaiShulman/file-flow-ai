"use client";
import type React from "react";
import { useState } from "react";
import type { FolderType, FileSystemItem, FileType, FileReference } from "@/lib/types";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Trash2,
  Database,
  FolderPlus,
  ArrowDownToLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import FileItem from "./file-item";
import { useSessionContext } from "@/features/session/context";

interface FolderItemProps {
  folder: FolderType;
  depth: number;
  expandedFolders: Set<string>;
  selectedFile?: FileType;
  onToggleFolder: (folderId: string) => void;
  onSelectFile: (file: FileType) => void;
  fileChangeTypes?: Record<string, string>;
  allFileMetadata?: Record<string, Record<string, any>>;
  onDeleteItem?: (path: string, name: string, itemType: "file" | "folder") => Promise<void>;
  onMoveItem?: (sourcePath: string, destPath: string, name: string) => Promise<void>;
  onCreateFolder?: (name: string, parentPath?: string) => Promise<void>;
  onAddToChat?: (fileRef: FileReference, isFolder?: boolean) => void;
}

export default function FolderItem({
  folder,
  depth,
  expandedFolders,
  selectedFile,
  onToggleFolder,
  onSelectFile,
  fileChangeTypes = {},
  allFileMetadata = {},
  onDeleteItem,
  onMoveItem,
  onCreateFolder,
  onAddToChat,
}: FolderItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isIconHovered, setIsIconHovered] = useState(false);

  const paddingLeft = depth * 16 + 8;
  const isExpanded = expandedFolders.has(folder.id);
  const isRoot = folder.id === "root";

  // Get affected files from session context
  const { sessionState } = useSessionContext();
  const affectedFiles = sessionState.affectedFiles;
  const recentlyAffectedFiles = sessionState.recentlyAffectedFiles;

  // Extract filename from a path (handles both / and \ separators)
  const getFileName = (p: string) => p.split(/[\\/]/).pop() || p;

  // Check if this folder is affected (by stable ID first, then fallback to path/name)
  const isFolderAffected = affectedFiles.some((af) =>
    af === folder.id || af === folder.path || getFileName(af) === folder.name
  );

  // Lookup by stable file ID first, then fallback to path/name for backwards compatibility
  const getChangeType = (id: string, name: string, path?: string): string | undefined => {
    if (fileChangeTypes[id]) return fileChangeTypes[id];
    if (path && fileChangeTypes[path]) return fileChangeTypes[path];
    if (fileChangeTypes[name]) return fileChangeTypes[name];
    return undefined;
  };

  const getFileMeta = (id: string, name: string, path?: string): Record<string, any> | undefined => {
    if (allFileMetadata[id]) return allFileMetadata[id];
    if (path && allFileMetadata[path]) return allFileMetadata[path];
    if (allFileMetadata[name]) return allFileMetadata[name];
    return undefined;
  };

  // Drop target handlers for move
  const handleDragOver = (e: React.DragEvent) => {
    // Accept file or folder drops (but not onto the same folder)
    if (
      e.dataTransfer.types.includes("application/fileflow-file") ||
      e.dataTransfer.types.includes("application/fileflow-folder")
    ) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!onMoveItem) return;

    // Try file first, then folder
    const fileData = e.dataTransfer.getData("application/fileflow-file");
    const folderData = e.dataTransfer.getData("application/fileflow-folder");
    const data = fileData || folderData;

    if (data) {
      try {
        const parsed = JSON.parse(data);
        // Don't move to same parent (paths are relative with forward slashes)
        const sep = parsed.path.lastIndexOf("/");
        const parentPath = sep > 0 ? parsed.path.substring(0, sep) : "";
        if (parentPath === folder.path) return;
        // Don't move folder into itself
        if (folderData && folder.path.startsWith(parsed.path)) return;

        onMoveItem(parsed.path, folder.path, parsed.name);
      } catch {
        // Invalid drag data
      }
    }
  };

  // New folder creation
  const handleCreateFolderSubmit = () => {
    const trimmed = newFolderName.trim();
    if (trimmed && onCreateFolder) {
      onCreateFolder(trimmed, folder.path);
    }
    setIsCreatingFolder(false);
    setNewFolderName("");
  };

  // Recursive function to render child items
  const renderItem = (item: FileSystemItem, currentDepth: number) => {
    if (item.type === "folder") {
      return (
        <FolderItem
          key={item.id}
          folder={item}
          depth={currentDepth}
          expandedFolders={expandedFolders}
          selectedFile={selectedFile}
          onToggleFolder={onToggleFolder}
          onSelectFile={onSelectFile}
          fileChangeTypes={fileChangeTypes}
          allFileMetadata={allFileMetadata}
          onDeleteItem={onDeleteItem}
          onMoveItem={onMoveItem}
          onCreateFolder={onCreateFolder}
          onAddToChat={onAddToChat}
        />
      );
    } else {
      // Check if this file is affected (by stable ID first, then fallback)
      const isAffected = affectedFiles.some((af) =>
        af === item.id || af === item.path || getFileName(af) === item.name
      );

      const changeType = getChangeType(item.id, item.name, item.path);
      const fileMeta = getFileMeta(item.id, item.name, item.path);
      const isRecentlyAffected = recentlyAffectedFiles.some((af) =>
        af === item.id || af === item.path || getFileName(af) === item.name
      );

      return (
        <FileItem
          key={item.id}
          file={item}
          isSelected={selectedFile?.id === item.id}
          paddingLeft={currentDepth * 16 + 24}
          onSelect={onSelectFile}
          isAffected={isAffected}
          changeType={changeType}
          fileMetadata={fileMeta}
          isRecentlyAffected={isRecentlyAffected}
          onDelete={onDeleteItem ? (file) => onDeleteItem(file.path, file.name, "file") : undefined}
          onAddToChat={onAddToChat ? (file) => onAddToChat({ name: file.name, path: file.path, id: file.id }, false) : undefined}
          onMoveItem={onMoveItem}
        />
      );
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      "application/fileflow-folder",
      JSON.stringify({ name: folder.name, path: folder.path, id: folder.id })
    );
    e.dataTransfer.effectAllowed = "copy";
    // Stop propagation so parent folders don't also start dragging
    e.stopPropagation();
  };

  return (
    <div>
      <div
        draggable={!isRoot}
        onDragStart={!isRoot ? handleDragStart : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex items-center py-0.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded cursor-pointer group",
          isRoot && "font-semibold",
          isFolderAffected &&
            !isRoot &&
            "bg-violet-50 dark:bg-violet-900/20",
          isDragOver && "ring-2 ring-violet-400 bg-violet-50 dark:bg-violet-900/30"
        )}
        style={{ paddingLeft: isRoot ? "8px" : `${paddingLeft}px` }}
        onClick={() => onToggleFolder(folder.id)}
        onMouseLeave={() => setIsIconHovered(false)}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
        )}
        {isRoot ? (
          <Database className="h-3.5 w-3.5 text-stone-700 dark:text-stone-300 mr-1.5 flex-shrink-0" />
        ) : (
          <span
            className="relative h-3.5 w-3.5 mr-1.5 flex-shrink-0"
            onMouseEnter={() => onAddToChat && setIsIconHovered(true)}
            onMouseLeave={() => setIsIconHovered(false)}
            onClick={
              onAddToChat
                ? (e) => {
                    e.stopPropagation();
                    onAddToChat({ name: folder.name, path: folder.path, id: folder.id }, true);
                  }
                : undefined
            }
            title={onAddToChat ? "Add to chat" : undefined}
          >
            {isIconHovered && onAddToChat ? (
              <ArrowDownToLine className="h-3.5 w-3.5 text-amber-600 cursor-pointer" />
            ) : (
              <Folder
                className="h-3.5 w-3.5"
                style={{ color: "#7c3aed", fill: "#7c3aed" }}
              />
            )}
          </span>
        )}
        <span
          className={cn(
            "truncate text-xs",
            isFolderAffected &&
              !isRoot &&
              "font-medium text-violet-700 dark:text-violet-300"
          )}
        >
          {folder.name}
        </span>
        <span className="ml-1.5 text-[10px] text-stone-400">
          ({folder.children.length})
        </span>

        <div className="ml-auto flex items-center gap-1">
          {isFolderAffected && !isRoot && (
            <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
              NEW
            </span>
          )}
        </div>

        <div className="opacity-0 group-hover:opacity-100 flex items-center">
          {onCreateFolder && (
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 hover:text-violet-600"
              onClick={(e) => {
                e.stopPropagation();
                setIsCreatingFolder(true);
                // Expand folder so user can see the new input
                if (!isExpanded) onToggleFolder(folder.id);
              }}
              title="New subfolder"
            >
              <FolderPlus className="h-3 w-3" />
            </Button>
          )}
          {onDeleteItem && !isRoot && (
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div>
          {/* Inline new folder input */}
          {isCreatingFolder && (
            <div
              className="flex items-center gap-1 py-0.5"
              style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
            >
              <Folder
                className="h-3.5 w-3.5 flex-shrink-0"
                style={{ color: "#7c3aed", fill: "#7c3aed" }}
              />
              <input
                autoFocus
                className="text-xs bg-transparent border-b border-violet-400 outline-none px-1 py-0.5 w-32"
                placeholder="Folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolderSubmit();
                  if (e.key === "Escape") {
                    setIsCreatingFolder(false);
                    setNewFolderName("");
                  }
                }}
                onBlur={handleCreateFolderSubmit}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          {folder.children.map((child) => renderItem(child, depth + 1))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder &quot;{folder.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the folder and all its contents ({folder.children.length} items).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => onDeleteItem?.(folder.path, folder.name, "folder")}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
