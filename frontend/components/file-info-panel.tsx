"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, History } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { FileType } from "@/lib/types"
import MetadataEditor from "@/features/metadata/components/metadata-editor"
import ChangesList from "@/features/changes/components/changes-list"

interface FileInfoPanelProps {
  selectedFile: FileType | null
  sessionId: string | null
}

export default function FileInfoPanel({ selectedFile, sessionId }: FileInfoPanelProps) {
  if (!selectedFile) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a file to view details
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-1 pb-2 border-b shrink-0">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium truncate">{selectedFile.name}</span>
      </div>

      <Tabs defaultValue="metadata" className="flex-1 flex flex-col overflow-hidden mt-2">
        <TabsList className="grid w-full grid-cols-2 h-8 shrink-0">
          <TabsTrigger value="metadata" className="text-xs gap-1">
            <FileText className="h-3 w-3" />
            Metadata
          </TabsTrigger>
          <TabsTrigger value="changes" className="text-xs gap-1">
            <History className="h-3 w-3" />
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
            <ChangesList key={selectedFile.name} sessionId={sessionId} filterByFile={selectedFile.name} />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
