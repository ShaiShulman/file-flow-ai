"use client";
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

  // Check if this folder is affected
  const isFolderAffected = affectedFiles.some((affectedPath) => {
    // Extract just the filename/folder name from the affected path
    const affectedName = affectedPath.split("/").pop() || affectedPath;
    const folderName = folder.name;

    // Check for exact matches only:
    // 1. Direct name match (for renamed folders)
    // 2. Exact path match (if we have full paths)
    const matches =
      affectedName === folderName ||
      affectedPath === folderName ||
      (folder.path && affectedPath === folder.path);

    return matches;
  });

  // Helper to find change type for a file/folder
  const getChangeType = (name: string, path?: string): string | undefined => {
    if (path && fileChangeTypes[path]) return fileChangeTypes[path];
    if (fileChangeTypes[name]) return fileChangeTypes[name];
    // Check by matching the last segment of affected paths
    for (const [key, value] of Object.entries(fileChangeTypes)) {
      const keyName = key.split("/").pop() || key;
      if (keyName === name) return value;
    }
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
      // Check if this file is affected by comparing paths
      const isAffected = affectedFiles.some((affectedPath) => {
        const affectedName = affectedPath.split("/").pop() || affectedPath;
        const fileName = item.name;
        return (
          affectedName === fileName ||
          affectedPath === fileName ||
          (item.path && affectedPath === item.path)
        );
      });

      const changeType = getChangeType(item.name, item.path);
      const fileMeta = allFileMetadata[item.path] || allFileMetadata[item.name];
      const isRecentlyAffected = recentlyAffectedFiles.some((p) => {
        const recentName = p.split("/").pop() || p;
        return recentName === item.name || p === item.name || (item.path && p === item.path);
      });

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

  return (
    <div>
      <div
        className={cn(
          "flex items-center py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer group",
          isRoot && "font-semibold",
          isFolderAffected &&
            !isRoot &&
            "bg-green-50 dark:bg-green-900/20 border-l-2 border-green-500"
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
          <Database className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300 mr-1.5 flex-shrink-0" />
        ) : (
          <Folder
            className={cn(
              "h-3.5 w-3.5 mr-1.5 flex-shrink-0",
              isFolderAffected ? "text-green-600" : "text-blue-500"
            )}
          />
        )}
        <span
          className={cn(
            "truncate text-xs",
            isFolderAffected &&
              !isRoot &&
              "font-medium text-green-700 dark:text-green-300"
          )}
        >
          {folder.name}
        </span>
        <span className="ml-1.5 text-[10px] text-slate-500">
          ({folder.children.length})
        </span>

        {isFolderAffected && !isRoot && (
          <span className="ml-1.5 text-[10px] text-green-600 dark:text-green-400 font-medium">
            ⚡ Modified
          </span>
        )}

        <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center">
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
