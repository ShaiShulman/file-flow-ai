"use client"

import type { FileType } from "@/lib/types"
import { FileText, FileIcon as FilePdf, Edit, Trash2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface FileItemProps {
  file: FileType
  isSelected: boolean
  paddingLeft: number
  onSelect: (file: FileType) => void
}

export default function FileItem({ file, isSelected, paddingLeft, onSelect }: FileItemProps) {
  return (
    <div
      className={cn(
        "flex items-center py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer group",
        isSelected && "bg-slate-100 dark:bg-slate-800",
      )}
      style={{ paddingLeft: `${paddingLeft}px` }}
      onClick={() => onSelect(file)}
    >
      {file.extension === "pdf" ? (
        <FilePdf className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
      ) : (
        <FileText className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" />
      )}
      <span className="truncate">{file.name}</span>

      {file.changed && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="ml-2">
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Modified</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
  )
}
