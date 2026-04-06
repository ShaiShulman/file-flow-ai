"use client";

import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  StopCircle,
  ArrowUp,
  Loader2,
  AlertCircle,
  FileText,
  Undo2,
  MousePointerClick,
} from "lucide-react";
import { getFileIcon } from "@/lib/utils/file-icons";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useChat, type ChatMessage } from "@/features/chat/hooks";
import FileBadge from "./file-badge";
import ClarificationBubble from "./clarification-bubble";
import type { FileReference } from "@/lib/types";

// SVG icon strings for imperative badge creation (drag-drop)
const FILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`;
const FOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#7c3aed" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function getIconSvgForFile(name: string): { svg: string; color: string } {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const colorMap: Record<string, string> = {
    pdf: "#ef4444",
    doc: "#3b82f6",
    docx: "#3b82f6",
    xls: "#16a34a",
    xlsx: "#16a34a",
    csv: "#16a34a",
    ppt: "#f97316",
    pptx: "#f97316",
    jpg: "#ec4899",
    jpeg: "#ec4899",
    png: "#ec4899",
    gif: "#ec4899",
    svg: "#ec4899",
    webp: "#ec4899",
    txt: "#78716c",
    md: "#78716c",
    rtf: "#78716c",
    zip: "#d97706",
    rar: "#d97706",
    "7z": "#d97706",
    tar: "#d97706",
    gz: "#d97706",
    json: "#ca8a04",
    xml: "#ca8a04",
    yaml: "#ca8a04",
    yml: "#ca8a04",
  };
  const color = colorMap[ext] || "#a8a29e";
  return {
    svg: FILE_SVG.replace('stroke="currentColor"', `stroke="${color}"`),
    color,
  };
}

function parseMessageContent(
  content: string,
  onFileClick?: (fileName: string) => void,
): React.ReactNode {
  const parts = content.split(/(\[\[file:[^\]]+\]\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[\[file:([^\]]+)\]\]$/);
    if (match) {
      return (
        <FileBadge key={index} fileName={match[1]} onClick={onFileClick} />
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function parseUserMessage(content: string): React.ReactNode {
  // Parse inline {{file:name}} markers in user messages
  const parts = content.split(/(\{\{file:[^}]+\}\})/g);
  const hasFileRefs = parts.some((p) => /^\{\{file:.+\}\}$/.test(p));
  if (!hasFileRefs) {
    // Also handle legacy "[Files: name1, name2] rest" format from restored messages
    const legacyMatch = content.match(/^\[Files:\s*(.+?)\]\s*([\s\S]*)$/);
    if (!legacyMatch) return content;
    const fileNames = legacyMatch[1].split(",").map((n) => n.trim());
    const rest = legacyMatch[2];
    return (
      <>
        {fileNames.map((name, i) => {
          const ext = name.split(".").pop();
          const { icon: TypeIcon, color } = getFileIcon(ext);
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-xs text-amber-800 dark:text-amber-200 border border-amber-200 align-middle"
            >
              <TypeIcon className="h-3 w-3 shrink-0" style={{ color }} />
              {name}
            </span>
          );
        })}
        {rest && <span> {rest}</span>}
      </>
    );
  }

  return parts.map((part, index) => {
    const match = part.match(/^\{\{file:(.+)\}\}$/);
    if (match) {
      const ext = match[1].split(".").pop();
      const { icon: TypeIcon, color } = getFileIcon(ext);
      return (
        <span
          key={index}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-xs text-amber-800 dark:text-amber-200 border border-amber-200 align-middle"
        >
          <TypeIcon className="h-3 w-3 shrink-0" style={{ color }} />
          {match[1]}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

interface ChatInterfaceProps {
  sessionId: string | null;
  workingDirectory?: string;
  updateAffectedFiles?: (files: string[]) => void;
  onFolderStructureChange?: (
    affectedFiles?: string[],
    lastAffectedFiles?: string[],
  ) => void;
  onResponseData?: (data: {
    actions: Array<Record<string, any>>;
    file_metadata: Record<string, any>;
  }) => void;
  onFileSelect?: (fileName: string) => void;
  onChatReady?: (callbacks: {
    addRevertMessage: (content: string) => void;
    addUserActionMessage: (content: string) => void;
    insertFileBadge: (fileRef: FileReference, isFolder?: boolean) => void;
  }) => void;
}

export default function ChatInterface({
  sessionId,
  workingDirectory,
  updateAffectedFiles,
  onFolderStructureChange,
  onResponseData,
  onFileSelect,
  onChatReady,
}: ChatInterfaceProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { chatState, sendMessage, stopGeneration, loadMessages, addRevertMessage, addUserActionMessage, answerClarification, declineClarification } = useChat(
    sessionId,
    updateAffectedFiles,
    onFolderStructureChange,
    onResponseData,
  );

  // Load messages from backend when session is restored (messages empty but session exists)
  useEffect(() => {
    if (
      sessionId &&
      chatState.messages.length === 0 &&
      !chatState.isProcessing
    ) {
      loadMessages();
    }
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom when messages change or processing state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatState.messages, chatState.isProcessing]);

  // Extract text and file references from the contentEditable editor
  const getEditorContent = useCallback((): {
    text: string;
    fileNames: string[];
  } => {
    const editor = editorRef.current;
    if (!editor) return { text: "", fileNames: [] };

    const fileNames: string[] = [];
    let text = "";

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || "";
      } else if (node instanceof HTMLElement) {
        const fileName = node.getAttribute("data-file-ref");
        if (fileName) {
          text += `{{file:${fileName}}}`;
          fileNames.push(fileName);
        } else {
          // Handle <br> as newline
          if (node.tagName === "BR") {
            text += "\n";
          } else {
            for (const child of node.childNodes) {
              walk(child);
            }
            // Block elements add a newline (except the last one)
            if (node.tagName === "DIV" && node.nextSibling) {
              text += "\n";
            }
          }
        }
      }
    };

    for (const child of editor.childNodes) {
      walk(child);
    }

    return { text: text.trim(), fileNames };
  }, []);

  const clearEditor = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
  }, []);

  const handleSendMessage = async () => {
    const { text, fileNames } = getEditorContent();
    if (!text && fileNames.length === 0) return;

    clearEditor();
    await sendMessage(text, workingDirectory);
  };

  const handleStopGeneration = () => {
    stopGeneration();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Insert a file/folder badge at the current cursor position in the editor
  const insertFileBadge = useCallback(
    (fileRef: FileReference, isFolder = false) => {
      const editor = editorRef.current;
      if (!editor) return;

      // Check if already inserted
      const existing = editor.querySelector(
        `[data-file-ref="${fileRef.name}"]`,
      );
      if (existing) return;

      // Pick the right icon SVG
      const iconSvg = isFolder
        ? FOLDER_SVG
        : getIconSvgForFile(fileRef.name).svg;

      // Create the badge element
      const badge = document.createElement("span");
      badge.setAttribute("data-file-ref", fileRef.name);
      badge.setAttribute("contenteditable", "false");
      badge.className =
        "inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-xs text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700 align-middle select-none";
      badge.innerHTML = `${iconSvg}<span>${fileRef.name}</span>`;

      // Add remove button
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "ml-0.5 hover:text-red-500 transition-colors";
      removeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        badge.remove();
        editor.focus();
      });
      badge.appendChild(removeBtn);

      // Insert at cursor position or at end
      const selection = window.getSelection();
      if (
        selection &&
        selection.rangeCount > 0 &&
        editor.contains(selection.anchorNode)
      ) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(badge);
        // Move cursor after the badge
        range.setStartAfter(badge);
        range.setEndAfter(badge);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        editor.appendChild(badge);
      }

      // Add a space after the badge for continued typing
      const space = document.createTextNode("\u00A0");
      badge.after(space);
      // Move cursor after space
      const newRange = document.createRange();
      newRange.setStartAfter(space);
      newRange.setEndAfter(space);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(newRange);
      }

      editor.focus();
    },
    [],
  );

  // Expose chat callbacks to parent (must be after insertFileBadge definition)
  useEffect(() => {
    if (onChatReady) {
      onChatReady({ addRevertMessage, addUserActionMessage, insertFileBadge });
    }
  }, [onChatReady, addRevertMessage, addUserActionMessage, insertFileBadge]);

  // Drag-and-drop handlers (accept both files and folders)
  const handleDragOver = (e: React.DragEvent) => {
    if (
      e.dataTransfer.types.includes("application/fileflow-file") ||
      e.dataTransfer.types.includes("application/fileflow-folder")
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only set false if we're leaving the container (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const fileData = e.dataTransfer.getData("application/fileflow-file");
    const folderData = e.dataTransfer.getData("application/fileflow-folder");
    if (fileData) {
      try {
        const fileRef: FileReference = JSON.parse(fileData);
        insertFileBadge(fileRef, false);
      } catch {
        /* Invalid data */
      }
    } else if (folderData) {
      try {
        const folderRef: FileReference = JSON.parse(folderData);
        insertFileBadge(folderRef, true);
      } catch {
        /* Invalid data */
      }
    }
  };

  // Handle paste: strip formatting, keep only plain text
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          {chatState.messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              What changes do you want to make?
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {chatState.messages.map((message: ChatMessage) => {
                // Compact revert notification
                if (message.isRevert) {
                  return (
                    <div
                      key={message.id}
                      className="flex items-center gap-2 mx-auto max-w-[90%] px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800"
                    >
                      <Undo2 className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-xs text-amber-700 dark:text-amber-300 truncate">
                        {message.content}
                      </span>
                      <span className="text-[10px] text-amber-400 dark:text-amber-600 shrink-0">
                        {formatRelativeTime(message.timestamp)}
                      </span>
                    </div>
                  );
                }

                // Compact user action notification
                if (message.isUserAction) {
                  return (
                    <div
                      key={message.id}
                      className="flex items-center gap-2 mx-auto max-w-[90%] px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800"
                    >
                      <MousePointerClick className="h-3 w-3 text-slate-500 dark:text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                        {message.content}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-600 shrink-0">
                        {formatRelativeTime(message.timestamp)}
                      </span>
                    </div>
                  );
                }

                return (
                <div
                  key={message.id}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    message.role === "user"
                      ? "ml-auto items-end"
                      : "mr-auto items-start",
                  )}
                >
                  {/* Message bubble */}
                  <div
                    className={cn(
                      "flex flex-col items-start p-3 w-full",
                      message.role === "user"
                        ? "bg-stone-100 dark:bg-stone-800 rounded-2xl rounded-br-sm"
                        : message.isError
                          ? "bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-800 rounded-2xl rounded-bl-sm"
                          : message.clarification
                            ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl rounded-bl-sm"
                            : "bg-white dark:bg-stone-900 border border-stone-200 rounded-2xl rounded-bl-sm",
                    )}
                  >
                    {message.isError && (
                      <div className="flex items-center gap-1.5 mb-1.5 text-red-600 dark:text-red-400">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-xs font-medium">Error</span>
                      </div>
                    )}
                    <div
                      className={cn(
                        "whitespace-pre-wrap text-xs text-left",
                        message.isError && "text-red-700 dark:text-red-300",
                      )}
                    >
                      {message.role === "assistant"
                        ? parseMessageContent(message.content, onFileSelect)
                        : parseUserMessage(message.content)}
                    </div>

                    {/* Affected files count for assistant messages */}
                    {message.role === "assistant" &&
                      message.metadata?.last_affected_files &&
                      message.metadata.last_affected_files.length > 0 && (
                        <div className="flex items-l gap-1 mt-2 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3 " />
                          <span>
                            {
                              new Set(
                                message.metadata.last_affected_files.map(
                                  (p) => p.split(/[\\/]/).pop() || p,
                                ),
                              ).size
                            }{" "}
                            file(s) affected
                          </span>
                        </div>
                      )}

                    {/* Clarification question UI */}
                    {message.clarification && (
                      <ClarificationBubble
                        clarification={message.clarification}
                        onAnswer={(answer) =>
                          answerClarification(message.id, answer, workingDirectory)
                        }
                        onDecline={() => declineClarification(message.id)}
                      />
                    )}
                  </div>

                  {/* Timestamp + stats below bubble */}
                  <div
                    className={cn(
                      "flex items-center gap-2 mt-1 px-1 w-full",
                      message.role === "user"
                        ? "justify-end"
                        : "justify-between",
                    )}
                  >
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelativeTime(message.timestamp)}
                    </span>
                    {message.stats && (
                      <div className="flex gap-1.5 text-[10px] text-muted-foreground">
                        <span>{message.stats.input_tokens} in</span>
                        <span>{message.stats.output_tokens} out</span>
                        <span>${message.stats.cost_usd.toFixed(4)}</span>
                        <span>
                          {(message.stats.duration_ms / 1000).toFixed(1)}s
                        </span>
                      </div>
                    )}
                    {message.tokens && !message.stats && (
                      <span className="text-[10px] text-muted-foreground">
                        {message.tokens} tokens
                      </span>
                    )}
                  </div>
                </div>
                );
              })}

              {/* Processing indicator */}
              {chatState.isProcessing && (
                <div className="flex flex-col p-3 bg-white dark:bg-stone-900 border border-stone-200 mr-auto max-w-[85%] rounded-2xl rounded-bl-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                    <span className="text-sm text-muted-foreground">
                      Processing your request...
                    </span>
                  </div>
                  {chatState.progress && chatState.progress.total > 1 ? (
                    <div className="mt-2 pl-6 space-y-1.5">
                      <div className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.round((chatState.progress.current / chatState.progress.total) * 100))}%`,
                          }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span>Processing file </span>
                        <span className="font-medium tabular-nums">
                          {chatState.progress.current}/
                          {chatState.progress.total}
                        </span>
                        {chatState.progress.current_file && (
                          <span title={chatState.progress.current_file}>
                            :{" "}
                            {chatState.progress.current_file.length > 35
                              ? chatState.progress.current_file.slice(0, 32) +
                                "..."
                              : chatState.progress.current_file}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : chatState.currentAction ? (
                    <div className="mt-1.5 text-xs text-muted-foreground/70 pl-6">
                      {chatState.currentAction}
                    </div>
                  ) : null}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="pt-3">
        <div
          className={cn(
            "relative rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950 transition-colors focus-within:ring-2 focus-within:ring-violet-300 dark:focus-within:ring-violet-700",
            isDragOver &&
              "ring-2 ring-violet-400 bg-violet-100/50 dark:bg-violet-900/30",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex items-center gap-2">
            <div
              ref={editorRef}
              contentEditable={!chatState.isProcessing}
              role="textbox"
              title="Chat message input"
              aria-multiline="true"
              aria-placeholder="What changes do you want to make?"
              className={cn(
                "flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none min-h-[80px] max-h-[200px] overflow-y-auto",
                "empty:before:content-[attr(aria-placeholder)] empty:before:text-violet-300 empty:before:pointer-events-none",
              )}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              suppressContentEditableWarning
            />
            <div className="self-center pr-2 shrink-0">
              {chatState.isProcessing ? (
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={handleStopGeneration}
                  className="rounded-full h-8 w-8"
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  className="rounded-full h-8 w-8 bg-violet-600 dark:bg-violet-500 hover:bg-violet-700 dark:hover:bg-violet-400"
                >
                  <ArrowUp className="h-4 w-4 text-white" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
