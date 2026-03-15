"use client";

import { FileText } from "lucide-react";

interface FileBadgeProps {
  fileName: string;
  onClick?: (fileName: string) => void;
}

export default function FileBadge({ fileName, onClick }: FileBadgeProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(fileName)}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30
                 text-amber-800 dark:text-amber-200 text-sm font-medium hover:bg-amber-100
                 dark:hover:bg-amber-800/40 transition-colors border border-amber-200 dark:border-amber-700
                 cursor-pointer"
    >
      <FileText className="h-3 w-3" />
      {fileName}
    </button>
  );
}
