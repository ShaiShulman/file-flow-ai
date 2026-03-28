import type { LucideIcon } from "lucide-react";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  FileType2,
  FileArchive,
  FileCode,
  File,
} from "lucide-react";

export interface FileIconInfo {
  icon: LucideIcon;
  color: string;
}

const extensionMap: Record<string, FileIconInfo> = {
  // PDF — red
  pdf:  { icon: FileText, color: "#ef4444" },
  // Word — blue
  doc:  { icon: FileText, color: "#3b82f6" },
  docx: { icon: FileText, color: "#3b82f6" },
  // Excel — green
  xls:  { icon: FileSpreadsheet, color: "#16a34a" },
  xlsx: { icon: FileSpreadsheet, color: "#16a34a" },
  csv:  { icon: FileSpreadsheet, color: "#16a34a" },
  // PowerPoint — orange
  ppt:  { icon: FileText, color: "#f97316" },
  pptx: { icon: FileText, color: "#f97316" },
  // Images — pink
  jpg:  { icon: FileImage, color: "#ec4899" },
  jpeg: { icon: FileImage, color: "#ec4899" },
  png:  { icon: FileImage, color: "#ec4899" },
  gif:  { icon: FileImage, color: "#ec4899" },
  svg:  { icon: FileImage, color: "#ec4899" },
  webp: { icon: FileImage, color: "#ec4899" },
  // Text — stone
  txt:  { icon: FileType2, color: "#78716c" },
  md:   { icon: FileType2, color: "#78716c" },
  rtf:  { icon: FileType2, color: "#78716c" },
  // Archives — amber
  zip:  { icon: FileArchive, color: "#d97706" },
  rar:  { icon: FileArchive, color: "#d97706" },
  "7z": { icon: FileArchive, color: "#d97706" },
  tar:  { icon: FileArchive, color: "#d97706" },
  gz:   { icon: FileArchive, color: "#d97706" },
  // Data — yellow
  json: { icon: FileCode, color: "#ca8a04" },
  xml:  { icon: FileCode, color: "#ca8a04" },
  yaml: { icon: FileCode, color: "#ca8a04" },
  yml:  { icon: FileCode, color: "#ca8a04" },
};

const defaultIcon: FileIconInfo = { icon: File, color: "#a8a29e" };

export function getFileIcon(extension?: string): FileIconInfo {
  if (!extension) return defaultIcon;
  const ext = extension.toLowerCase().replace(/^\./, "");
  return extensionMap[ext] || defaultIcon;
}
