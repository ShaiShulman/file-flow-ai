"use client";

import type React from "react";
import type { FileType } from "@/lib/types";
import {
  FileText,
  FileIcon as FilePdf,
  Edit,
  Trash2,
  AlertCircle,
  PlusCircle,
  ArrowRightLeft,
  Copy,
  Pencil,
  ScanLine,
} from "lucide-react";
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
    return {
      icon: <PlusCircle className="h-3 w-3 text-green-500" />,
      bg: "bg-green-50 dark:bg-green-900/20",
      border: "border-green-500",
      label: "Created",
    };
  if (changeType.includes("delete"))
    return {
      icon: <Trash2 className="h-3 w-3 text-red-500" />,
      bg: "bg-red-50 dark:bg-red-900/20",
      border: "border-red-500",
      label: "Deleted",
    };
  if (changeType.includes("copy"))
    return {
      icon: <Copy className="h-3 w-3 text-violet-500" />,
      bg: "bg-violet-50 dark:bg-violet-900/20",
      border: "border-violet-500",
      label: "Copied",
    };
  if (changeType.includes("move"))
    return {
      icon: <ArrowRightLeft className="h-3 w-3 text-amber-500" />,
      bg: "bg-amber-50 dark:bg-amber-900/20",
      border: "border-amber-500",
      label: "Moved",
    };
  if (changeType.includes("rename") || changeType.includes("modify"))
    return {
      icon: <Pencil className="h-3 w-3 text-blue-500" />,
      bg: "bg-blue-50 dark:bg-blue-900/20",
      border: "border-blue-500",
      label: "Modified",
    };
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
        "flex items-center py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer group",
        isSelected && "bg-blue-600 text-white hover:bg-blue-700",
        !isSelected && indicator
          ? `${indicator.bg} border-l-2 ${indicator.border}`
          : !isSelected && isAffected && "bg-green-50 dark:bg-green-900/20 border-l-2 border-green-500",
        isRecentlyAffected && "animate-pulse-highlight"
      )}
      style={{ paddingLeft: `${paddingLeft}px` }}
      onClick={() => onSelect(file)}
    >
      {file.extension === "pdf" ? (
        <FilePdf className={cn("h-3.5 w-3.5 mr-1.5 flex-shrink-0", isSelected ? "text-white" : "text-red-500")} />
      ) : (
        <FileText className={cn("h-3.5 w-3.5 mr-1.5 flex-shrink-0", isSelected ? "text-white" : "text-blue-500")} />
      )}
      <span className="truncate text-xs">{file.name}</span>

      {fileMetadata?._ocr_scanned && (
        <ScanLine className="h-3 w-3 ml-1 text-cyan-500 shrink-0" title="OCR scanned" />
      )}

      {indicator && (
        <div className="ml-1.5 shrink-0">{indicator.icon}</div>
      )}

      {isAffected && !indicator && (
        <div className="ml-1.5 shrink-0">
          <PlusCircle className="h-3 w-3 text-green-600" />
        </div>
      )}

      {file.changed && !indicator && (
        <div className="ml-1.5 shrink-0">
          <AlertCircle className="h-3 w-3 text-amber-500" />
        </div>
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
