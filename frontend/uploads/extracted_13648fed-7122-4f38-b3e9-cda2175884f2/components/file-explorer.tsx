"use client"

import { useState } from "react"
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  FileIcon as FilePdf,
  Edit,
  Trash2,
  AlertCircle,
  Database,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"

// Types for our file system
type FileType = {
  id: string
  name: string
  type: "file"
  extension?: string
  metadata?: Record<string, any>
  changed?: boolean
  path: string
}

type FolderType = {
  id: string
  name: string
  type: "folder"
  children: (FileType | FolderType)[]
  path: string
}

type FileSystemItem = FileType | FolderType

// Sample data
const sampleData: FolderType = {
  id: "root",
  name: "root",
  type: "folder",
  path: "/",
  children: [
    {
      id: "folder1",
      name: "Incorporation Documents",
      type: "folder",
      path: "/Incorporation Documents",
      children: [
        {
          id: "file1",
          name: "Certificate of Incorporation.pdf",
          type: "file",
          extension: "pdf",
          path: "/Incorporation Documents/Certificate of Incorporation.pdf",
          metadata: {
            category: "Incorporation",
            type: "Certificate",
            status: "Final",
            date: "2023-05-15",
          },
          changed: true,
        },
        {
          id: "file2",
          name: "Articles of Incorporation.pdf",
          type: "file",
          extension: "pdf",
          path: "/Incorporation Documents/Articles of Incorporation.pdf",
          metadata: {
            category: "Incorporation",
            type: "Articles",
            status: "Final",
            date: "2023-05-10",
          },
        },
        {
          id: "file3",
          name: "Deeds of Incorporation.pdf",
          type: "file",
          extension: "pdf",
          path: "/Incorporation Documents/Deeds of Incorporation.pdf",
          metadata: {
            category: "Incorporation",
            type: "Deeds",
            status: "Draft",
            date: "2023-05-20",
          },
          changed: true,
        },
      ],
    },
    {
      id: "folder2",
      name: "Legal Briefs",
      type: "folder",
      path: "/Legal Briefs",
      children: [
        {
          id: "file4",
          name: "Case Summary.docx",
          type: "file",
          extension: "docx",
          path: "/Legal Briefs/Case Summary.docx",
          metadata: {
            category: "Case Documents",
            type: "Summary",
            status: "Draft",
            assignee: "John Doe",
          },
        },
      ],
    },
    {
      id: "folder3",
      name: "Compliance",
      type: "folder",
      path: "/Compliance",
      children: [
        {
          id: "file5",
          name: "Regulatory Guidelines.pdf",
          type: "file",
          extension: "pdf",
          path: "/Compliance/Regulatory Guidelines.pdf",
          metadata: {
            category: "Compliance",
            type: "Guidelines",
            status: "Important",
            date: "2023-04-15",
          },
        },
        {
          id: "folder4",
          name: "Policies",
          type: "folder",
          path: "/Compliance/Policies",
          children: [
            {
              id: "file6",
              name: "Privacy Policy.docx",
              type: "file",
              extension: "docx",
              path: "/Compliance/Policies/Privacy Policy.docx",
              metadata: {
                category: "Policy",
                type: "Privacy",
                status: "Public",
                version: "2.1",
              },
              changed: true,
            },
          ],
        },
      ],
    },
  ],
}

export default function FileExplorer() {
  const [fileSystem] = useState<FolderType>(sampleData)
  const [selectedFile, setSelectedFile] = useState<FileType | undefined>(undefined)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["root", "folder1", "folder2", "folder3", "folder4"]),
  )

  // Function to handle file selection
  const handleSelectFile = (file: FileType) => {
    setSelectedFile(file)
    // Notify parent component or context about selected file
    window.dispatchEvent(new CustomEvent("fileSelected", { detail: file }))
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

  // Recursive function to render the file tree
  const renderTree = (item: FileSystemItem, depth = 0) => {
    const paddingLeft = depth * 20 + 8

    if (item.type === "folder") {
      const isExpanded = expandedFolders.has(item.id)
      const isRoot = item.id === "root"

      return (
        <div key={item.id}>
          <div
            className={cn(
              "flex items-center py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer group",
              isRoot && "font-semibold",
            )}
            style={{ paddingLeft: isRoot ? "8px" : `${paddingLeft}px` }}
            onClick={() => toggleFolder(item.id)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 mr-1 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 mr-1 flex-shrink-0" />
            )}
            {isRoot ? (
              <Database className="h-4 w-4 text-slate-700 dark:text-slate-300 mr-2 flex-shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" />
            )}
            <span className="truncate">{item.name}</span>
            <span className="ml-2 text-xs text-slate-500">({item.children.length})</span>

            <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center">
              <Button size="icon" variant="ghost" className="h-7 w-7">
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {isExpanded && <div>{item.children.map((child) => renderTree(child, depth + 1))}</div>}
        </div>
      )
    } else {
      // File item
      const isSelected = selectedFile?.id === item.id

      return (
        <div
          key={item.id}
          className={cn(
            "flex items-center py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer group",
            isSelected && "bg-slate-100 dark:bg-slate-800",
          )}
          style={{ paddingLeft: `${paddingLeft + 20}px` }}
          onClick={() => handleSelectFile(item)}
        >
          {item.extension === "pdf" ? (
            <FilePdf className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
          ) : (
            <FileText className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" />
          )}
          <span className="truncate">{item.name}</span>

          {item.changed && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="ml-2">
                    <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Modified</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center">
            <Button size="icon" variant="ghost" className="h-7 w-7">
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="h-full overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">File Structure</h2>
      </div>

      <div className="space-y-1">{renderTree(fileSystem)}</div>
    </div>
  )
}
