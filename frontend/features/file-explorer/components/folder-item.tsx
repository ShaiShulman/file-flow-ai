"use client";
import type React from "react";
import type { FolderType, FileSystemItem, FileType } from "@/lib/types";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Edit,
  Trash2,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
}: FolderItemProps) {
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
        className={cn(
          "flex items-center py-0.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded cursor-pointer group",
          isRoot && "font-semibold",
          isFolderAffected &&
            !isRoot &&
            "bg-violet-50 dark:bg-violet-900/20"
        )}
        style={{ paddingLeft: isRoot ? "8px" : `${paddingLeft}px` }}
        onClick={() => onToggleFolder(folder.id)}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
        )}
        {isRoot ? (
          <Database className="h-3.5 w-3.5 text-stone-700 dark:text-stone-300 mr-1.5 flex-shrink-0" />
        ) : (
          <Folder
            className="h-3.5 w-3.5 mr-1.5 flex-shrink-0"
            style={{ color: "#7c3aed", fill: "#7c3aed" }}
          />
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
          <Button size="icon" variant="ghost" className="h-5 w-5">
            <Edit className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-5 w-5">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div>
          {folder.children.map((child) => renderItem(child, depth + 1))}
        </div>
      )}
    </div>
  );
}
