"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, Trash2, Edit, ArrowRightLeft, FileText,
  ChevronDown, ChevronRight, Undo2, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { apiClient } from "@/features/api/client"
import type { ActionRecord } from "@/lib/types"

interface ChangesListProps {
  sessionId: string | null
  filterByFile?: string
}

export default function ChangesList({ sessionId, filterByFile }: ChangesListProps) {
  const [actions, setActions] = useState<ActionRecord[]>([])
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [revertingId, setRevertingId] = useState<number | null>(null)
  const { toast } = useToast()

  const fetchActions = useCallback(async () => {
    if (!sessionId) return
    try {
      const result = await apiClient.getActions(sessionId)
      setActions(result.actions as ActionRecord[])
    } catch (err) {
      console.error("Failed to fetch actions:", err)
    }
  }, [sessionId])

  useEffect(() => {
    fetchActions()
    // Re-fetch every 5s to pick up new actions from agent
    const interval = setInterval(fetchActions, 5000)
    return () => clearInterval(interval)
  }, [fetchActions])

  const handleRevert = async (actionId: number) => {
    if (!sessionId) return
    setRevertingId(actionId)
    try {
      const result = await apiClient.revertAction(sessionId, actionId)
      if (result.success) {
        toast({ title: "Reverted", description: result.message })
        await fetchActions()
      } else {
        toast({ title: "Revert Failed", description: result.message, variant: "destructive" })
      }
    } catch (err) {
      toast({
        title: "Revert Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setRevertingId(null)
    }
  }

  const toggleFile = (key: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const getActionIcon = (type: string) => {
    if (type.includes("create")) return <Plus className="h-4 w-4 text-green-500" />
    if (type.includes("delete")) return <Trash2 className="h-4 w-4 text-red-500" />
    if (type.includes("move")) return <ArrowRightLeft className="h-4 w-4 text-amber-500" />
    if (type.includes("rename") || type.includes("modify")) return <Edit className="h-4 w-4 text-blue-500" />
    return <FileText className="h-4 w-4" />
  }

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Upload files to see action history
      </div>
    )
  }

  if (actions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No actions yet
      </div>
    )
  }

  // Filter by file if specified
  const filteredActions = filterByFile
    ? actions.filter((a) => {
        const name = a.item_name || ""
        const basename = name.split("/").pop() || name
        const sourcePath = a.source_path || ""
        const sourceBase = sourcePath.split("/").pop() || sourcePath
        const targetPath = a.target_path || ""
        const targetBase = targetPath.split("/").pop() || targetPath
        const newName = a.new_name || ""
        return (
          basename === filterByFile ||
          name === filterByFile ||
          sourceBase === filterByFile ||
          targetBase === filterByFile ||
          newName === filterByFile
        )
      })
    : actions

  if (filterByFile && filteredActions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No changes for this file
      </div>
    )
  }

  // Group actions by item_name
  const grouped: Record<string, ActionRecord[]> = {}
  for (const action of filteredActions) {
    const key = action.item_name || "unknown"
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(action)
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Action History</h3>
        <span className="text-xs text-muted-foreground">{filteredActions.length} action(s)</span>
      </div>

      <div className="space-y-1">
        {Object.entries(grouped).map(([fileName, fileActions]) => (
          <div key={fileName} className="border rounded-md">
            <button
              onClick={() => toggleFile(fileName)}
              className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-sm"
            >
              {expandedFiles.has(fileName) ? (
                <ChevronDown className="h-3 w-3 shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0" />
              )}
              <span className="font-medium truncate">{fileName}</span>
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                {fileActions.length}
              </span>
            </button>

            {expandedFiles.has(fileName) && (
              <div className="border-t px-3 py-1 space-y-1">
                {fileActions.map((action) => (
                  <div
                    key={action.id}
                    className={`flex items-start gap-2 py-1.5 text-sm ${
                      action.reverted ? "opacity-50 line-through" : ""
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">{getActionIcon(action.action_type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs">{action.description}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(action.created_at).toLocaleString()}
                      </div>
                    </div>
                    {action.revertable && !action.reverted && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 shrink-0"
                        onClick={() => handleRevert(action.id)}
                        disabled={revertingId === action.id}
                      >
                        {revertingId === action.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Undo2 className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                    {action.reverted && (
                      <span className="text-xs text-muted-foreground shrink-0">reverted</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
