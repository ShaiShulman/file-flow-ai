"use client"

import { useState } from "react"
import type { FileType } from "@/lib/types"
import { sampleData } from "../data"
import FolderItem from "./folder-item"

interface FileExplorerProps {
  onFileSelect: (file: FileType) => void
}

export default function FileExplorer({ onFileSelect }: FileExplorerProps) {
  const [fileSystem] = useState(sampleData)
  const [selectedFile, setSelectedFile] = useState<FileType | undefined>(undefined)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["root", "folder1", "folder2", "folder3", "folder4"]),
  )

  // Function to handle file selection
  const handleSelectFile = (file: FileType) => {
    setSelectedFile(file)
    onFileSelect(file)
  }

  // Function to toggle folder expansion
  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }

  return (
    <div className="h-full overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">File Structure</h2>
      </div>

      <div className="space-y-1">
        <FolderItem
          folder={fileSystem}
          depth={0}
          expandedFolders={expandedFolders}
          selectedFile={selectedFile}
          onToggleFolder={toggleFolder}
          onSelectFile={handleSelectFile}
        />
      </div>
    </div>
  )
}
