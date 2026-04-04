"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, History, Pencil, Clock } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { FileType, ActionRecord } from "@/lib/types"
import MetadataEditor from "@/features/metadata/components/metadata-editor"
import ChangesList from "@/features/changes/components/changes-list"

interface FileInfoPanelProps {
  selectedFile: FileType | null
  sessionId: string | null
  onRevertSuccess?: (action: ActionRecord, revertMessage: string) => void
}

export default function FileInfoPanel({ selectedFile, sessionId, onRevertSuccess }: FileInfoPanelProps) {
  if (!selectedFile) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a file to view details
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-1 pb-2 shrink-0">
        <FileText className="h-3.5 w-3.5 text-violet-600" />
        <span className="text-sm font-semibold truncate text-stone-900">{selectedFile.name}</span>
      </div>

      <Tabs defaultValue="metadata" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-2 h-8 shrink-0 bg-transparent rounded-none border-b border-stone-200 p-0">
          <TabsTrigger value="metadata" className="text-xs gap-1 rounded-none shadow-none bg-transparent data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-violet-600 pb-2">
            <Pencil className="h-3 w-3" />
            Metadata
          </TabsTrigger>
          <TabsTrigger value="changes" className="text-xs gap-1 rounded-none shadow-none bg-transparent data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-violet-600 pb-2">
            <Clock className="h-3 w-3" />
            Changes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metadata" className="flex-1 overflow-hidden mt-2">
          <ScrollArea className="h-full">
            <MetadataEditor selectedFile={selectedFile} sessionId={sessionId} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="changes" className="flex-1 overflow-hidden mt-2">
          <ScrollArea className="h-full">
            <ChangesList key={selectedFile.name} sessionId={sessionId} filterByFile={selectedFile.name} onRevertSuccess={onRevertSuccess} />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
