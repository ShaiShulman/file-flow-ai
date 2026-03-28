"use client"

import { useState } from "react"
import { Eye, FileText, BarChart3 } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { FileType } from "@/lib/types"
import FileInfoPanel from "@/components/file-info-panel"
import SessionPanel from "@/components/session-panel"

type TabId = "preview" | "details" | "general"

const tabs: { id: TabId; icon: typeof Eye; label: string }[] = [
  { id: "preview", icon: Eye, label: "Preview" },
  { id: "details", icon: FileText, label: "File Details" },
  { id: "general", icon: BarChart3, label: "General" },
]

interface UnifiedInfoPanelProps {
  selectedFile: FileType | null
  sessionId: string | null
}

export default function UnifiedInfoPanel({ selectedFile, sessionId }: UnifiedInfoPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("details")

  return (
    <div className="flex h-full">
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-col items-center w-10 border-r border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 py-2 gap-1 shrink-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
                      isActive
                        ? "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border-l-2 border-violet-600 dark:border-violet-400"
                        : "text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-600 dark:hover:text-stone-400"
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {tab.label}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>

      <div className="flex-1 overflow-hidden p-2">
        {activeTab === "preview" && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            File preview coming soon
          </div>
        )}
        {activeTab === "details" && (
          <FileInfoPanel selectedFile={selectedFile} sessionId={sessionId} />
        )}
        {activeTab === "general" && (
          <SessionPanel sessionId={sessionId} />
        )}
      </div>
    </div>
  )
}
