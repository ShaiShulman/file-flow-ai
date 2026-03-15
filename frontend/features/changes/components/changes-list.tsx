"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, Trash2, Edit, ArrowRightLeft, FileText,
  Undo2, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { apiClient } from "@/features/api/client"
import type { ActionRecord } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ChangesListProps {
  sessionId: string | null
  filterByFile?: string
}

function getIconBgClass(type: string) {
  if (type.includes("create")) return "bg-green-500"
  if (type.includes("delete")) return "bg-red-500"
  if (type.includes("move")) return "bg-amber-500"
  if (type.includes("rename") || type.includes("modify")) return "bg-blue-500"
  return "bg-stone-400"
}

function getActionIcon(type: string) {
  if (type.includes("create")) return <Plus className="h-2.5 w-2.5 text-white" />
  if (type.includes("delete")) return <Trash2 className="h-2.5 w-2.5 text-white" />
  if (type.includes("move")) return <ArrowRightLeft className="h-2.5 w-2.5 text-white" />
  if (type.includes("rename") || type.includes("modify")) return <Edit className="h-2.5 w-2.5 text-white" />
  return <FileText className="h-2.5 w-2.5 text-white" />
}

export default function ChangesList({ sessionId, filterByFile }: ChangesListProps) {
  const [actions, setActions] = useState<ActionRecord[]>([])
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

  return (
    <div className="space-y-0.5">
      {filteredActions.map((action) => (
        <div
          key={action.id}
          className={cn(
            "flex items-center gap-2 px-2 py-1 rounded group",
            action.reverted && "opacity-50"
          )}
        >
          <div className={cn(
            "w-[18px] h-[18px] rounded flex items-center justify-center shrink-0",
            getIconBgClass(action.action_type)
          )}>
            {getActionIcon(action.action_type)}
          </div>
          <span className={cn(
            "text-xs truncate flex-1",
            action.reverted && "line-through"
          )}>
            {action.description}
          </span>
          <span className="text-[10px] text-stone-400 shrink-0">
            {new Date(action.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {action.revertable && !action.reverted && (
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100"
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
            <span className="text-[10px] text-stone-400 shrink-0">reverted</span>
          )}
        </div>
      ))}
    </div>
  )
}
