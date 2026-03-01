"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { apiClient } from "@/features/api/client"

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string | null
}

export default function ExportDialog({
  open,
  onOpenChange,
  sessionId,
}: ExportDialogProps) {
  const [basePath, setBasePath] = useState("")
  const [format, setFormat] = useState("powershell")
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const handleExport = async () => {
    if (!sessionId || !basePath.trim()) return

    setIsExporting(true)
    try {
      const result = await apiClient.exportScript(sessionId, basePath, format)

      // Trigger download
      const blob = new Blob([result.script], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Script exported",
        description: `Downloaded ${result.filename}`,
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Script</DialogTitle>
          <DialogDescription>
            Generate a script to apply file changes on your local machine.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="basePath">Local base folder path</Label>
            <Input
              id="basePath"
              placeholder="C:\Users\...\Documents\LegalFiles"
              value={basePath}
              onChange={(e) => setBasePath(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The script will use this as the root folder for all file operations.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Script format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="powershell">PowerShell (.ps1)</SelectItem>
                <SelectItem value="batch">Batch (.bat)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={!basePath.trim() || !sessionId || isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
