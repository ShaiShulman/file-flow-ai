// File and folder types
export type FileType = {
  id: string
  name: string
  type: "file"
  extension?: string
  metadata?: Record<string, any>
  changed?: boolean
  path: string
}

export type FolderType = {
  id: string
  name: string
  type: "folder"
  children: (FileType | FolderType)[]
  path: string
}

export type FileSystemItem = FileType | FolderType

// Category types
export type Category = {
  id: string
  name: string
  description: string
  options: string[]
}

// Chat message types
export type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  tokens?: number
  timestamp: Date
}

// Change record types
export type ChangeRecord = {
  id: string
  type: "add" | "rename" | "delete" | "move" | "copy" | "modify"
  path: string
  timestamp: Date
  details?: string
}
