"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { History, Tag, BarChart3 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import ChangesList from "@/features/changes/components/changes-list"
import CategoryEditor from "@/features/categories/components/category-editor"
import AnalyticsTab from "@/features/analytics/components/analytics-tab"

interface SessionPanelProps {
  sessionId: string | null
}

export default function SessionPanel({ sessionId }: SessionPanelProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs defaultValue="changes" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3 h-8 shrink-0">
          <TabsTrigger value="changes" className="text-xs gap-1">
            <History className="h-3 w-3" />
            All Changes
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-xs gap-1">
            <Tag className="h-3 w-3" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1">
            <BarChart3 className="h-3 w-3" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="changes" className="flex-1 overflow-hidden mt-2">
          <ScrollArea className="h-full">
            <ChangesList sessionId={sessionId} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="categories" className="flex-1 overflow-hidden mt-2">
          <ScrollArea className="h-full">
            <CategoryEditor />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="analytics" className="flex-1 overflow-hidden mt-2">
          <ScrollArea className="h-full">
            <AnalyticsTab sessionId={sessionId} />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
