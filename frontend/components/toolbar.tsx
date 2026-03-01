"use client";

import { useState } from "react";
import {
  Upload,
  Download,
  Settings,
  Search,
  RefreshCw,
  FileText,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import UploadDialog from "@/features/upload/components/upload-dialog";
import type { FolderType } from "@/lib/types";

interface ToolbarProps {
  onFilesExtracted: (files: FolderType, folderId: string) => void;
  onDownload: () => Promise<void>;
  isDownloading: boolean;
  onExport?: () => void;
  hasSession?: boolean;
}

export default function Toolbar({
  onFilesExtracted,
  onDownload,
  isDownloading,
  onExport,
  hasSession = false,
}: ToolbarProps) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const handleFilesExtracted = (
    folderName: string,
    files: FolderType,
    folderId: string
  ) => {
    if (onFilesExtracted) {
      onFilesExtracted(files, folderId);
    }
  };

  return (
    <div
      className="border-b px-4 py-2 sticky top-0 z-10"
      style={{
        background: "linear-gradient(to right, #e6f0ff, #d4e6ff, #c2dcff)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-700" />
          <h1 className="text-lg font-bold text-slate-800">FileFlow.ai</h1>
        </div>

        <div className="flex items-center gap-2 mx-4 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2 top-2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search documents..."
              className="pl-8 h-8 bg-white border-slate-300 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <TooltipProvider>
            {/* Primary actions with labels */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUploadOpen(true)}
              className="bg-white border-slate-300 hover:bg-slate-100 h-8 text-xs"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              disabled={isDownloading}
              className="bg-white border-slate-300 hover:bg-slate-100 h-8 text-xs"
            >
              {isDownloading ? (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              {isDownloading ? "Downloading..." : "Download"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={!hasSession}
              className="bg-white border-slate-300 hover:bg-slate-100 h-8 text-xs"
            >
              <FileCode className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>

            <div className="w-px h-6 bg-slate-300 mx-1" />

            {/* Secondary actions - icon only */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-white/50"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-slate-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-white/50"
                >
                  <Settings className="h-3.5 w-3.5 text-slate-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <UploadDialog
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        onFilesExtracted={handleFilesExtracted}
      />
    </div>
  );
}
