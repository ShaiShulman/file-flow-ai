"use client";

import { Folder } from "lucide-react";
import { getFileIcon } from "@/lib/utils/file-icons";

interface FileBadgeProps {
  fileName: string;
  onClick?: (fileName: string) => void;
  isFolder?: boolean;
}

export default function FileBadge({ fileName, onClick, isFolder = false }: FileBadgeProps) {
  const ext = fileName.split(".").pop();
  const { icon: FileIcon, color } = getFileIcon(ext);

  return (
    <button
      type="button"
      onClick={() => onClick?.(fileName)}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30
                 text-amber-800 dark:text-amber-200 text-xs font-medium hover:bg-amber-100
                 dark:hover:bg-amber-800/40 transition-colors border border-amber-200 dark:border-amber-700
                 cursor-pointer"
    >
      {isFolder ? (
        <Folder className="h-3 w-3" style={{ color: "#7c3aed", fill: "#7c3aed" }} />
      ) : (
        <FileIcon className="h-3 w-3" style={{ color }} />
      )}
      {fileName}
    </button>
  );
}
