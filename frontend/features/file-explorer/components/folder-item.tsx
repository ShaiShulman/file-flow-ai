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

  // Extract filename from a path (handles both / and \ separators)
  const getFileName = (p: string) => p.split(/[\\/]/).pop() || p;

  // Check if this folder is affected
  const isFolderAffected = affectedFiles.some((affectedPath) => {
    const affectedName = getFileName(affectedPath);
    const folderName = folder.name;

    return (
      affectedName === folderName ||
      affectedPath === folderName ||
      (folder.path && affectedPath === folder.path)
    );
  });

  // Helper to find change type for a file/folder
  const getChangeType = (name: string, path?: string): string | undefined => {
    if (path && fileChangeTypes[path]) return fileChangeTypes[path];
    if (fileChangeTypes[name]) return fileChangeTypes[name];
    // Check by matching the last segment of affected paths
    for (const [key, value] of Object.entries(fileChangeTypes)) {
      const keyName = getFileName(key);
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
        const affectedName = getFileName(affectedPath);
        return (
          affectedName === item.name ||
          affectedPath === item.name ||
          (item.path && affectedPath === item.path)
        );
      });

      const changeType = getChangeType(item.name, item.path);
      const fileMeta = allFileMetadata[item.path] || allFileMetadata[item.name];
      const isRecentlyAffected = recentlyAffectedFiles.some((p) => {
        const recentName = getFileName(p);
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
          "flex items-center py-0.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded cursor-pointer group",
          isRoot && "font-semibold",
          isFolderAffected &&
            !isRoot &&
            "bg-amber-50 dark:bg-amber-900/20"
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
            className={cn(
              "h-3.5 w-3.5 mr-1.5 flex-shrink-0",
              isFolderAffected ? "text-amber-500" : "text-stone-500"
            )}
          />
        )}
        <span
          className={cn(
            "truncate text-xs",
            isFolderAffected &&
              !isRoot &&
              "font-medium text-amber-700 dark:text-amber-300"
          )}
        >
          {folder.name}
        </span>
        <span className="ml-1.5 text-[10px] text-stone-400">
          ({folder.children.length})
        </span>

        {isFolderAffected && !isRoot && (
          <span className="ml-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
            NEW
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
