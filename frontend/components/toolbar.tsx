"use client";

import { useState, useEffect } from "react";
import {
  Upload,
  Download,
  Settings,
  Search,
  RefreshCw,
  FileCode,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import UploadDialog from "@/features/upload/components/upload-dialog";
import { apiClient } from "@/features/api/client";
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
  const [exactMatch, setExactMatch] = useState(true);

  useEffect(() => {
    apiClient.getExactMatch().then((res) => setExactMatch(res.enabled)).catch(() => {});
  }, []);

  const handleExactMatchToggle = async (checked: boolean) => {
    setExactMatch(checked);
    try {
      await apiClient.setExactMatch(checked);
    } catch {
      setExactMatch(!checked);
    }
  };

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
    <div className="border-b border-violet-200 bg-gradient-to-r from-violet-600 via-violet-500 to-purple-500 px-4 py-2.5 sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg shadow-orange-500/30">
            <Sparkles className="h-5 w-5 text-white" />
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-violet-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              File<span className="text-amber-300">Flow</span>
            </h1>
            <span className="bg-amber-400/90 text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">AI</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mx-4 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-violet-300" />
            <Input
              placeholder="Search documents..."
              className="pl-8 h-8 bg-white/15 border-white/20 text-white placeholder:text-violet-200 text-sm focus:bg-white/25 focus:border-white/30 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <TooltipProvider>
            <Button
              size="sm"
              onClick={() => setIsUploadOpen(true)}
              className="bg-white text-violet-700 hover:bg-violet-50 h-8 text-xs font-medium shadow-sm"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              disabled={isDownloading}
              className="bg-white/15 border-white/25 text-white hover:bg-white/25 h-8 text-xs"
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
              className="bg-white/15 border-white/25 text-white hover:bg-white/25 h-8 text-xs"
            >
              <FileCode className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>

            <div className="w-px h-6 bg-white/20 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Switch
                    id="exact-match"
                    checked={exactMatch}
                    onCheckedChange={handleExactMatchToggle}
                    className="h-5 w-9 data-[state=checked]:bg-white [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4 [&>span]:data-[state=checked]:bg-violet-600"
                  />
                  <label htmlFor="exact-match" className="text-xs text-white/80 cursor-pointer whitespace-nowrap">
                    Exact Match
                  </label>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>When enabled, filename-pattern operations match by name directly without AI reviewing each file</p>
              </TooltipContent>
            </Tooltip>

            <div className="w-px h-6 bg-white/20 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-white/15 text-white/70 hover:text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
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
                  className="h-8 w-8 hover:bg-white/15 text-white/70 hover:text-white"
                >
                  <Settings className="h-3.5 w-3.5" />
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
