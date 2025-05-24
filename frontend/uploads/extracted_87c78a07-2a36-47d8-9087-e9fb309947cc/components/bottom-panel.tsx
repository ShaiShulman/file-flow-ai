"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, History, Tag } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { FileType } from "@/lib/types"
import MetadataEditor from "@/features/metadata/components/metadata-editor"
import CategoryEditor from "@/features/categories/components/category-editor"
import ChangesList from "@/features/changes/components/changes-list"

interface BottomPanelProps {
  selectedFile: FileType | null
}

export default function BottomPanel({ selectedFile }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState("metadata")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 h-12 mb-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
        <TabsTrigger
          value="metadata"
          className={`flex items-center gap-1 ${activeTab === "metadata" ? "bg-white dark:bg-slate-900 shadow-sm" : ""}`}
        >
          <FileText className="h-4 w-4" />
          <span>Metadata</span>
        </TabsTrigger>
        <TabsTrigger
          value="changes"
          className={`flex items-center gap-1 ${activeTab === "changes" ? "bg-white dark:bg-slate-900 shadow-sm" : ""}`}
        >
          <History className="h-4 w-4" />
          <span>Changes</span>
        </TabsTrigger>
        <TabsTrigger
          value="categories"
          className={`flex items-center gap-1 ${activeTab === "categories" ? "bg-white dark:bg-slate-900 shadow-sm" : ""}`}
        >
          <Tag className="h-4 w-4" />
          <span>Categories</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="metadata" className="mt-2">
        <ScrollArea className="h-[220px] pr-4">
          <MetadataEditor selectedFile={selectedFile} />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="changes" className="mt-2">
        <ScrollArea className="h-[220px] pr-4">
          <ChangesList />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="categories" className="mt-2">
        <ScrollArea className="h-[220px] pr-4">
          <CategoryEditor />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  )
}
