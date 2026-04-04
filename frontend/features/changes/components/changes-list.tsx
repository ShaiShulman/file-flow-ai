"use client"

import { useState, useEffect, useCallback } from "react"
import {
  FolderPlus, FilePlus, Trash2, FolderMinus, Edit, Pencil,
  ArrowRightLeft, Copy, Search, FileText,
  Undo2, Loader2,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import { apiClient } from "@/features/api/client"
import type { ActionRecord } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ChangesListProps {
  sessionId: string | null
  filterByFile?: string
  onRevertSuccess?: (action: ActionRecord, revertMessage: string) => void
}

function getIconBgClass(type: string) {
  if (type.includes("create") && type.includes("folder")) return "bg-emerald-500"
  if (type.includes("create")) return "bg-green-500"
  if (type.includes("delete") && type.includes("folder")) return "bg-rose-600"
  if (type.includes("delete")) return "bg-red-500"
  if (type.includes("copy")) return "bg-violet-500"
  if (type.includes("move")) return "bg-amber-500"
  if (type.includes("rename")) return "bg-sky-500"
  if (type.includes("modify")) return "bg-blue-500"
  if (type.includes("analyze")) return "bg-indigo-500"
  return "bg-stone-400"
}

function getActionIcon(type: string) {
  const cls = "h-2.5 w-2.5 text-white"
  if (type.includes("create") && type.includes("folder")) return <FolderPlus className={cls} />
  if (type.includes("create")) return <FilePlus className={cls} />
  if (type.includes("delete") && type.includes("folder")) return <FolderMinus className={cls} />
  if (type.includes("delete")) return <Trash2 className={cls} />
  if (type.includes("copy")) return <Copy className={cls} />
  if (type.includes("move")) return <ArrowRightLeft className={cls} />
  if (type.includes("rename")) return <Pencil className={cls} />
  if (type.includes("modify")) return <Edit className={cls} />
  if (type.includes("analyze")) return <Search className={cls} />
  return <FileText className={cls} />
}

interface DialogState {
  open: boolean
  action: ActionRecord | null
  canRevert: boolean
  message: string
  description: string
}

export default function ChangesList({ sessionId, filterByFile, onRevertSuccess }: ChangesListProps) {
  const [actions, setActions] = useState<ActionRecord[]>([])
  const [revertingId, setRevertingId] = useState<number | null>(null)
  const [checkingId, setCheckingId] = useState<number | null>(null)
  const [dialogState, setDialogState] = useState<DialogState | null>(null)
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

  const handleRevertClick = async (action: ActionRecord) => {
    if (!sessionId) return
    setCheckingId(action.id)
    try {
      const result = await apiClient.checkRevert(sessionId, action.id)
      setDialogState({
        open: true,
        action,
        canRevert: result.can_revert,
        message: result.message,
        description: result.description,
      })
    } catch (err) {
      toast({
        title: "Check Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setCheckingId(null)
    }
  }

  const handleConfirmRevert = async () => {
    if (!sessionId || !dialogState?.action) return
    const action = dialogState.action
    setDialogState(null)
    setRevertingId(action.id)
    try {
      const result = await apiClient.revertAction(sessionId, action.id)
      if (result.success) {
        toast({ title: "Reverted", description: result.message })
        await fetchActions()
        if (onRevertSuccess && result.revert_message) {
          onRevertSuccess(action, result.revert_message)
        }
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
    <>
      <TooltipProvider delayDuration={300}>
        <div className="space-y-0.5">
          {filteredActions.map((action) => {
            const canRevert = action.revertable && !action.reverted
            const isReverting = revertingId === action.id
            const isChecking = checkingId === action.id

            const row = (
              <div
                key={action.id}
                onClick={() => canRevert && !isReverting && !isChecking && handleRevertClick(action)}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md group transition-all duration-150",
                  action.reverted && "opacity-40",
                  canRevert && !isReverting && !isChecking && "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:shadow-sm",
                )}
              >
                {/* Icon area */}
                <div className="relative w-[18px] h-[18px] flex items-center justify-center shrink-0">
                  {isReverting || isChecking ? (
                    <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                  ) : (
                    <>
                      {/* Action type icon with colored bg */}
                      <div className={cn(
                        "w-[18px] h-[18px] rounded flex items-center justify-center transition-opacity duration-200",
                        getIconBgClass(action.action_type),
                        canRevert && "group-hover:opacity-0",
                      )}>
                        {getActionIcon(action.action_type)}
                      </div>
                      {/* Undo icon — no background, blue color */}
                      {canRevert && (
                        <Undo2 className="h-3.5 w-3.5 text-blue-500 absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      )}
                    </>
                  )}
                </div>
                <span className={cn(
                  "text-xs truncate flex-1 transition-colors duration-150",
                  action.reverted
                    ? "line-through text-stone-400"
                    : canRevert
                      ? "group-hover:text-blue-700 dark:group-hover:text-blue-300"
                      : "",
                )}>
                  {action.description}
                </span>
                <span className="text-[10px] text-stone-400 shrink-0">
                  {new Date(action.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {action.reverted && (
                  <span className="text-[10px] text-stone-400 italic shrink-0">reverted</span>
                )}
              </div>
            )

            if (canRevert) {
              return (
                <Tooltip key={action.id}>
                  <TooltipTrigger asChild>{row}</TooltipTrigger>
                  <TooltipContent side="left" className="text-xs">
                    Click to revert
                  </TooltipContent>
                </Tooltip>
              )
            }

            return row
          })}
        </div>
      </TooltipProvider>

      <AlertDialog open={!!dialogState?.open} onOpenChange={(open) => { if (!open) setDialogState(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogState?.canRevert ? "Confirm Revert" : "Cannot Revert"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogState?.canRevert
                ? dialogState.description
                : dialogState?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {dialogState?.canRevert && (
              <AlertDialogAction onClick={handleConfirmRevert}>
                Yes, Revert
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
