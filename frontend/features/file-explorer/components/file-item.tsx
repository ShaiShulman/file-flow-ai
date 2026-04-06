"use client";

import type React from "react";
import { useState } from "react";
import type { FileType } from "@/lib/types";
import {
  Trash2,
  ScanLine,
  ArrowDownToLine,
} from "lucide-react";
import { getFileIcon } from "@/lib/utils/file-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

interface FileItemProps {
  file: FileType;
  isSelected: boolean;
  paddingLeft: number;
  onSelect: (file: FileType) => void;
  isAffected?: boolean;
  changeType?: string;
  fileMetadata?: Record<string, any>;
  isRecentlyAffected?: boolean;
  onDelete?: (file: FileType) => void;
  onAddToChat?: (file: FileType) => void;
  onMoveItem?: (sourcePath: string, destPath: string, name: string) => Promise<void>;
}

function getChangeIndicator(changeType?: string) {
  if (!changeType) return null;
  if (changeType.includes("create"))
    return { dot: "bg-green-500", bg: "bg-green-50 dark:bg-green-900/20", label: "Created" };
  if (changeType.includes("delete"))
    return { dot: "bg-red-500", bg: "bg-red-50 dark:bg-red-900/20", label: "Deleted" };
  if (changeType.includes("copy"))
    return { dot: "bg-violet-500", bg: "bg-violet-50 dark:bg-violet-900/20", label: "Copied" };
  if (changeType.includes("move"))
    return { dot: "bg-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", label: "Moved" };
  if (changeType.includes("rename") || changeType.includes("modify"))
    return { dot: "bg-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", label: "Modified" };
  if (changeType.includes("analyze"))
    return { dot: "bg-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-900/20", label: "Analyzed" };
  return null;
}

export default function FileItem({
  file,
  isSelected,
  paddingLeft,
  onSelect,
  isAffected = false,
  changeType,
  fileMetadata,
  isRecentlyAffected = false,
  onDelete,
  onAddToChat,
  onMoveItem,
}: FileItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isIconHovered, setIsIconHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const indicator = getChangeIndicator(changeType);

  // Drop on a file = move to that file's parent folder
  const lastSep = Math.max(file.path.lastIndexOf("/"), file.path.lastIndexOf("\\"));
  const parentPath = lastSep > 0 ? file.path.substring(0, lastSep) : file.path;

  const handleFileDragOver = (e: React.DragEvent) => {
    if (
      onMoveItem &&
      (e.dataTransfer.types.includes("application/fileflow-file") ||
        e.dataTransfer.types.includes("application/fileflow-folder"))
    ) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    }
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!onMoveItem) return;

    const fileData = e.dataTransfer.getData("application/fileflow-file");
    const folderData = e.dataTransfer.getData("application/fileflow-folder");
    const data = fileData || folderData;
    if (!data) return;

    try {
      const parsed = JSON.parse(data);
      // Don't move to same location
      const dragSep = Math.max(parsed.path.lastIndexOf("/"), parsed.path.lastIndexOf("\\"));
      const draggedParent = dragSep > 0 ? parsed.path.substring(0, dragSep) : parsed.path;
      if (draggedParent === parentPath) return;
      // Don't drop on self
      if (parsed.path === file.path) return;

      onMoveItem(parsed.path, parentPath, parsed.name);
    } catch {
      // Invalid drag data
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      "application/fileflow-file",
      JSON.stringify({ name: file.name, path: file.path, id: file.id })
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  const ext = file.extension || file.name.split(".").pop();
  const { icon: FileTypeIcon, color } = getFileIcon(ext);

  const row = (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleFileDragOver}
      onDragLeave={handleFileDragLeave}
      onDrop={handleFileDrop}
      className={cn(
        "flex items-center py-0.5 rounded cursor-pointer group",
        !isRecentlyAffected && "hover:bg-stone-100 dark:hover:bg-stone-800",
        isSelected && !isRecentlyAffected && "bg-violet-50 text-violet-900 ring-1 ring-violet-300 hover:bg-violet-100",
        !isSelected && !isRecentlyAffected && indicator && indicator.bg,
        !isSelected && !isRecentlyAffected && !indicator && isAffected && "bg-green-50 dark:bg-green-900/20",
        isRecentlyAffected && "recently-affected",
        isDragOver && "ring-2 ring-violet-400 bg-violet-50 dark:bg-violet-900/30"
      )}
      style={{ paddingLeft: `${paddingLeft}px` }}
      onClick={() => onSelect(file)}
      onMouseLeave={() => setIsIconHovered(false)}
    >
      {/* File icon — swaps to add-to-chat arrow on hover */}
      <span
        className="relative h-3.5 w-3.5 mr-1.5 flex-shrink-0"
        onMouseEnter={() => onAddToChat && setIsIconHovered(true)}
        onMouseLeave={() => setIsIconHovered(false)}
        onClick={
          onAddToChat
            ? (e) => {
                e.stopPropagation();
                onAddToChat(file);
              }
            : undefined
        }
        title={onAddToChat ? "Add to chat" : undefined}
      >
        {isIconHovered && onAddToChat ? (
          <ArrowDownToLine className="h-3.5 w-3.5 text-amber-600 cursor-pointer" />
        ) : (
          <FileTypeIcon className="h-3.5 w-3.5" style={{ color }} />
        )}
      </span>

      <span className="truncate text-xs">{file.name}</span>

      {fileMetadata?._ocr_scanned && (
        <span title="OCR scanned"><ScanLine className="h-3 w-3 ml-1 text-cyan-500 shrink-0" /></span>
      )}

      <div className="ml-auto flex items-center gap-1">
        {indicator && (
          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", indicator.dot)} />
        )}
        {isAffected && !indicator && (
          <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-green-500" />
        )}
        {file.changed && !indicator && !isAffected && (
          <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-violet-500" />
        )}
      </div>

      {onDelete && (
        <div className="opacity-0 group-hover:opacity-100 flex items-center">
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
        </div>
      )}
    </div>
  );

  const dialog = (
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{file.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The file will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            onClick={() => onDelete?.(file)}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Wrap with tooltip if there's metadata
  const visibleMetadata = fileMetadata ? Object.keys(fileMetadata).filter(k => !k.startsWith("_")) : [];
  if (fileMetadata && visibleMetadata.length > 0) {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{row}</TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <div className="space-y-1 text-xs">
                {fileMetadata.category && <p><span className="font-medium">Category:</span> {fileMetadata.category}</p>}
                {fileMetadata.date && <p><span className="font-medium">Date:</span> {fileMetadata.date}</p>}
                {Object.entries(fileMetadata)
                  .filter(([k]) => !["category", "date"].includes(k) && !k.startsWith("_"))
                  .slice(0, 3)
                  .map(([k, v]) => (
                    <p key={k}><span className="font-medium">{k}:</span> {String(v).slice(0, 50)}</p>
                  ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {dialog}
      </>
    );
  }

  return (
    <>
      {row}
      {dialog}
    </>
  );
}
