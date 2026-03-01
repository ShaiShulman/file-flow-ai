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
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-600
                 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-300
                 dark:hover:bg-slate-500 transition-colors border border-slate-300 dark:border-slate-500
                 cursor-pointer"
    >
      <FileText className="h-3 w-3" />
      {fileName}
    </button>
  );
}
