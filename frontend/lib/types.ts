// File and folder types
export type FileType = {
  id: string;
  name: string;
  type: "file";
  extension?: string;
  metadata?: Record<string, any>;
  changed?: boolean;
  path: string;
};

export type FolderType = {
  id: string;
  name: string;
  type: "folder";
  children: (FileType | FolderType)[];
  path: string;
};

export type FileSystemItem = FileType | FolderType;

// Category types
export interface Category {
  id: string;
  name: string;
  options: string[];
}

// Chat message types
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tokens?: number;
  timestamp: Date;
};

// Change record types (legacy - kept for compatibility)
export type ChangeRecord = {
  id: string;
  type: "add" | "rename" | "delete" | "move" | "copy" | "modify";
  path: string;
  timestamp: Date;
  details?: string;
};

// Action record from backend
export type ActionRecord = {
  id: number;
  session_id: string;
  action_type: string;
  item_name: string;
  source_path?: string;
  target_path?: string;
  new_name?: string;
  description: string;
  reverted: boolean;
  revertable: boolean;
  created_at: string;
};

// Message stats from backend
export type MessageStats = {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  duration_ms: number;
};

// Session stats from backend
export type SessionStats = {
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  total_duration_ms: number;
  message_count: number;
  action_count: number;
  per_message_stats: Array<{
    id: number;
    role: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    duration_ms: number;
    created_at: string;
  }>;
};

// Metadata field definition
export type MetadataField = {
  field_name: string;
  field_type: string;
};

// File reference for drag-and-drop
export type FileReference = {
  name: string;
  path: string;
  id: string;
};
