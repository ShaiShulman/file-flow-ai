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
}

export default function FolderItem({
  folder,
  depth,
  expandedFolders,
  selectedFile,
  onToggleFolder,
  onSelectFile,
}: FolderItemProps) {
  const paddingLeft = depth * 20 + 8;
  const isExpanded = expandedFolders.has(folder.id);
  const isRoot = folder.id === "root";

  // Get affected files from session context
  const { sessionState } = useSessionContext();
  const affectedFiles = sessionState.affectedFiles;

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

  console.log(
    `[FOLDER-ITEM] Checking folder "${folder.name}" - affected: ${isFolderAffected}`,
    {
      folderPath: folder.path,
      folderName: folder.name,
      affectedFiles,
      affectedFilesNames: affectedFiles.map((path) => path.split("/").pop()),
    }
  );

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
        />
      );
    } else {
      // Check if this file is affected by comparing paths
      const isAffected = affectedFiles.some((affectedPath) => {
        const affectedName = affectedPath.split("/").pop() || affectedPath;
        const fileName = item.name;

        // Check for exact matches only
        return (
          affectedName === fileName ||
          affectedPath === fileName ||
          (item.path && affectedPath === item.path)
        );
      });

      return (
        <FileItem
          key={item.id}
          file={item}
          isSelected={selectedFile?.id === item.id}
          paddingLeft={currentDepth * 20 + 28}
          onSelect={onSelectFile}
          isAffected={isAffected}
        />
      );
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer group",
          isRoot && "font-semibold",
          isFolderAffected &&
            !isRoot &&
            "bg-green-50 dark:bg-green-900/20 border-l-2 border-green-500"
        )}
        style={{ paddingLeft: isRoot ? "8px" : `${paddingLeft}px` }}
        onClick={() => onToggleFolder(folder.id)}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 mr-1 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 mr-1 flex-shrink-0" />
        )}
        {isRoot ? (
          <Database className="h-4 w-4 text-slate-700 dark:text-slate-300 mr-2 flex-shrink-0" />
        ) : (
          <Folder
            className={cn(
              "h-4 w-4 mr-2 flex-shrink-0",
              isFolderAffected ? "text-green-600" : "text-blue-500"
            )}
          />
        )}
        <span
          className={cn(
            "truncate",
            isFolderAffected &&
              !isRoot &&
              "font-medium text-green-700 dark:text-green-300"
          )}
        >
          {folder.name}
        </span>
        <span className="ml-2 text-xs text-slate-500">
          ({folder.children.length})
        </span>

        {isFolderAffected && !isRoot && (
          <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-medium">
            ⚡ Modified
          </span>
        )}

        <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center">
          <Button size="icon" variant="ghost" className="h-7 w-7">
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7">
            <Trash2 className="h-3.5 w-3.5" />
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
