"use client";

import type React from "react";
import type { FileType } from "@/lib/types";
import {
  Edit,
  Trash2,
  ScanLine,
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

interface FileItemProps {
  file: FileType;
  isSelected: boolean;
  paddingLeft: number;
  onSelect: (file: FileType) => void;
  isAffected?: boolean;
  changeType?: string;
  fileMetadata?: Record<string, any>;
  isRecentlyAffected?: boolean;
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
}: FileItemProps) {
  const indicator = getChangeIndicator(changeType);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      "application/fileflow-file",
      JSON.stringify({ name: file.name, path: file.path, id: file.id })
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  const row = (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "flex items-center py-0.5 rounded cursor-pointer group",
        !isRecentlyAffected && "hover:bg-stone-100 dark:hover:bg-stone-800",
        isSelected && !isRecentlyAffected && "bg-violet-50 text-violet-900 ring-1 ring-violet-300 hover:bg-violet-100",
        !isSelected && !isRecentlyAffected && indicator && indicator.bg,
        !isSelected && !isRecentlyAffected && !indicator && isAffected && "bg-green-50 dark:bg-green-900/20",
        isRecentlyAffected && "recently-affected"
      )}
      style={{ paddingLeft: `${paddingLeft}px` }}
      onClick={() => onSelect(file)}
    >
      {(() => {
        const ext = file.extension || file.name.split(".").pop();
        const { icon: FileTypeIcon, color } = getFileIcon(ext);
        return <FileTypeIcon className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" style={{ color }} />;
      })()}
      <span className="truncate text-xs">{file.name}</span>

      {fileMetadata?._ocr_scanned && (
        <ScanLine className="h-3 w-3 ml-1 text-cyan-500 shrink-0" title="OCR scanned" />
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

      <div className="opacity-0 group-hover:opacity-100 flex items-center">
        <Button size="icon" variant="ghost" className="h-5 w-5">
          <Edit className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-5 w-5">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  // Wrap with tooltip if there's metadata
  const visibleMetadata = fileMetadata ? Object.keys(fileMetadata).filter(k => !k.startsWith("_")) : [];
  if (fileMetadata && visibleMetadata.length > 0) {
    return (
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
    );
  }

  return row;
}
