"use client"

import { useState } from "react"
import { Upload, Download, Settings, Search, RefreshCw, HelpCircle, FileText, FolderPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import UploadDialog from "@/features/upload/components/upload-dialog"
import { toast } from "@/components/ui/use-toast"

export default function Toolbar() {
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  return (
    <Card
      className="border-b rounded-none px-4 py-2 sticky top-0 z-10"
      style={{
        background: "linear-gradient(to right, #e6f0ff, #d4e6ff, #c2dcff)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-slate-700" />
          <h1 className="text-xl font-bold text-slate-800">Legal Document Categorizer</h1>
        </div>

        <div className="flex items-center gap-2 mx-4 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
            <Input placeholder="Search documents..." className="pl-8 bg-white border-slate-300" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsUploadOpen(true)}
                  className="bg-white border-slate-300 hover:bg-slate-100"
                >
                  <Upload className="h-4 w-4 text-slate-700" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Upload ZIP File</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    toast({
                      title: "Download Started",
                      description: "Downloading current bucket...",
                    })
                    // In a real app, this would trigger the actual download
                  }}
                  className="bg-white border-slate-300 hover:bg-slate-100"
                >
                  <Download className="h-4 w-4 text-slate-700" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download Current Bucket</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="bg-white border-slate-300 hover:bg-slate-100">
                  <FolderPlus className="h-4 w-4 text-slate-700" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>New Folder</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="bg-white border-slate-300 hover:bg-slate-100">
                  <RefreshCw className="h-4 w-4 text-slate-700" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="bg-white border-slate-300 hover:bg-slate-100">
                  <Settings className="h-4 w-4 text-slate-700" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="bg-white border-slate-300 hover:bg-slate-100">
                  <HelpCircle className="h-4 w-4 text-slate-700" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Help</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <UploadDialog open={isUploadOpen} onOpenChange={setIsUploadOpen} />
    </Card>
  )
}
