"use client";

import { useState } from "react";
import {
  Upload,
  Download,
  Settings,
  Search,
  RefreshCw,
  FilePlus,
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
    <div className="border-b border-stone-200 bg-stone-50 px-4 py-2 sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 bg-amber-600 rounded-lg">
            <FilePlus className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-lg font-bold text-stone-900 tracking-tight">FileFlow</h1>
          <span className="bg-amber-100 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">AI</span>
        </div>

        <div className="flex items-center gap-2 mx-4 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-stone-400" />
            <Input
              placeholder="Search documents..."
              className="pl-8 h-8 bg-stone-100 border-stone-200 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <TooltipProvider>
            <Button
              size="sm"
              onClick={() => setIsUploadOpen(true)}
              className="bg-stone-900 text-white hover:bg-stone-800 h-8 text-xs"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              disabled={isDownloading}
              className="bg-white border-stone-200 hover:bg-stone-50 h-8 text-xs"
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
              className="bg-white border-stone-200 hover:bg-stone-50 h-8 text-xs"
            >
              <FileCode className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>

            <div className="w-px h-6 bg-stone-200 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-stone-100"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-stone-500" />
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
                  className="h-8 w-8 hover:bg-stone-100"
                >
                  <Settings className="h-3.5 w-3.5 text-stone-500" />
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
