"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Save, Plus } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import type { FileType } from "@/lib/types"
import { initialCategories } from "../data"

// Types
type FileMetadata = {
  category?: string
  description?: string
  options?: string[]
}

interface MetadataEditorProps {
  selectedFile: FileType | null
}

export default function MetadataEditor({ selectedFile }: MetadataEditorProps) {
  const [fileMetadata, setFileMetadata] = useState<FileMetadata>({})
  const [newMetadataKey, setNewMetadataKey] = useState("")
  const [newMetadataValue, setNewMetadataValue] = useState("")
  const [editingMetadataKey, setEditingMetadataKey] = useState<string | null>(null)
  const [editingMetadataValue, setEditingMetadataValue] = useState("")
  const { toast } = useToast()
  const [categories] = useState(initialCategories)

  // Update metadata when selected file changes
  useEffect(() => {
    if (selectedFile) {
      setFileMetadata(selectedFile.metadata || {})
    } else {
      setFileMetadata({})
    }
  }, [selectedFile])

  const handleSaveMetadata = () => {
    if (!selectedFile) return

    toast({
      title: "Metadata saved",
      description: `Updated metadata for ${selectedFile.name}`,
    })
  }

  const handleAddMetadata = () => {
    if (!newMetadataKey.trim() || !selectedFile) return

    setFileMetadata({
      ...fileMetadata,
      [newMetadataKey]: newMetadataValue,
    })

    setNewMetadataKey("")
    setNewMetadataValue("")
  }

  const handleEditMetadata = (key: string) => {
    setEditingMetadataKey(key)
    setEditingMetadataValue(fileMetadata[key])
  }

  const handleSaveMetadataEdit = () => {
    if (!editingMetadataKey || !selectedFile) return

    const updatedMetadata = { ...fileMetadata }
    updatedMetadata[editingMetadataKey] = editingMetadataValue

    setFileMetadata(updatedMetadata)
    setEditingMetadataKey(null)
    setEditingMetadataValue("")
  }

  const handleDeleteMetadata = (key: string) => {
    if (!selectedFile) return

    const updatedMetadata = { ...fileMetadata }
    delete updatedMetadata[key]

    setFileMetadata(updatedMetadata)
  }

  if (!selectedFile) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a file to view metadata
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">File Metadata</h3>
        <Button size="sm" variant="outline" onClick={handleSaveMetadata}>
          <Save className="h-3.5 w-3.5 mr-1" />
          Save
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          value={fileMetadata.category || ""}
          onValueChange={(value) => setFileMetadata({ ...fileMetadata, category: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.name}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={fileMetadata.description || ""}
          onChange={(e) => setFileMetadata({ ...fileMetadata, description: e.target.value })}
          placeholder="Enter a description for this file"
        />
      </div>

      <div className="space-y-2">
        <Label>Options</Label>
        <div className="flex flex-wrap gap-2">
          {fileMetadata.category &&
            categories
              .find((c) => c.name === fileMetadata.category)
              ?.options.map((option) => (
                <Badge
                  key={option}
                  variant={fileMetadata.options?.includes(option) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    const currentOptions = fileMetadata.options || []
                    const newOptions = currentOptions.includes(option)
                      ? currentOptions.filter((o) => o !== option)
                      : [...currentOptions, option]
                    setFileMetadata({ ...fileMetadata, options: newOptions })
                  }}
                >
                  {option}
                </Badge>
              ))}
        </div>
      </div>

      <div className="flex items-end gap-2 mt-4">
        <div className="space-y-1 flex-1">
          <Input
            placeholder="Key"
            value={newMetadataKey}
            onChange={(e) => setNewMetadataKey(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1 flex-1">
          <Input
            placeholder="Value"
            value={newMetadataValue}
            onChange={(e) => setNewMetadataValue(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <Button size="sm" onClick={handleAddMetadata} disabled={!newMetadataKey.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>
    </div>
  )
}
