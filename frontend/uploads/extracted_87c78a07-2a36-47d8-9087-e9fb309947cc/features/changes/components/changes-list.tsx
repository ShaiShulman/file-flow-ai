"use client"

import { Plus, Trash2, Edit, FileText } from "lucide-react"
import { mockChanges } from "../data"
import { formatTimeAgo } from "@/lib/utils"

export default function ChangesList() {
  const getChangeIcon = (type: string) => {
    switch (type) {
      case "add":
        return <Plus className="h-4 w-4 text-green-500" />
      case "delete":
        return <Trash2 className="h-4 w-4 text-red-500" />
      case "rename":
        return <Edit className="h-4 w-4 text-blue-500" />
      case "move":
        return <FileText className="h-4 w-4 text-purple-500" />
      case "copy":
        return <FileText className="h-4 w-4 text-amber-500" />
      case "modify":
        return <Edit className="h-4 w-4 text-slate-500" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Recent Changes</h3>
      </div>

      <div className="space-y-3">
        {mockChanges.map((change) => (
          <div key={change.id} className="flex items-start gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="mt-0.5">{getChangeIcon(change.type)}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm capitalize">{change.type}</div>
                <div className="text-xs text-muted-foreground">{formatTimeAgo(change.timestamp)}</div>
              </div>
              <div className="text-sm mt-1 text-slate-700 dark:text-slate-300 break-all">{change.path}</div>
              {change.details && <div className="text-xs mt-1 text-muted-foreground">{change.details}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
