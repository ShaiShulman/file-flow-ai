"use client";

import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { StopCircle, ArrowUp, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useChat, type ChatMessage } from "@/features/chat/hooks";
import FileBadge from "./file-badge";
import type { FileReference } from "@/lib/types";

function parseMessageContent(
  content: string,
  onFileClick?: (fileName: string) => void
): React.ReactNode {
  const parts = content.split(/(\[\[file:[^\]]+\]\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[\[file:([^\]]+)\]\]$/);
    if (match) {
      return <FileBadge key={index} fileName={match[1]} onClick={onFileClick} />;
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
        {fileNames.map((name, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-200 dark:bg-slate-600 text-xs text-slate-700 dark:text-slate-200 align-middle"
          >
            <FileText className="h-3 w-3 text-slate-500 dark:text-slate-400" />
            {name}
          </span>
        ))}
        {rest && <span> {rest}</span>}
      </>
    );
  }

  return parts.map((part, index) => {
    const match = part.match(/^\{\{file:(.+)\}\}$/);
    if (match) {
      return (
        <span
          key={index}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-200 dark:bg-slate-600 text-xs text-slate-700 dark:text-slate-200 align-middle"
        >
          <FileText className="h-3 w-3 text-slate-500 dark:text-slate-400" />
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
  onFolderStructureChange?: (affectedFiles?: string[]) => void;
  onResponseData?: (data: { actions: Array<Record<string, any>>; file_metadata: Record<string, any> }) => void;
  onFileSelect?: (fileName: string) => void;
}

export default function ChatInterface({
  sessionId,
  workingDirectory,
  updateAffectedFiles,
  onFolderStructureChange,
  onResponseData,
  onFileSelect,
}: ChatInterfaceProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { chatState, sendMessage, stopGeneration, loadMessages } = useChat(
    sessionId,
    updateAffectedFiles,
    onFolderStructureChange,
    onResponseData
  );

  // Load messages from backend when session is restored (messages empty but session exists)
  useEffect(() => {
    if (sessionId && chatState.messages.length === 0 && !chatState.isProcessing) {
      loadMessages();
    }
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom when messages change or processing state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatState.messages, chatState.isProcessing]);

  // Extract text and file references from the contentEditable editor
  const getEditorContent = useCallback((): { text: string; fileNames: string[] } => {
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

  // Insert a file badge at the current cursor position in the editor
  const insertFileBadge = useCallback((fileRef: FileReference) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Check if already inserted
    const existing = editor.querySelector(`[data-file-ref="${fileRef.name}"]`);
    if (existing) return;

    // Create the badge element
    const badge = document.createElement("span");
    badge.setAttribute("data-file-ref", fileRef.name);
    badge.setAttribute("contenteditable", "false");
    badge.className =
      "inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-300 align-middle select-none";
    badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-500" style="display:inline;vertical-align:middle"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg><span>${fileRef.name}</span>`;

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
    if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
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
  }, []);

  // Drag-and-drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/fileflow-file")) {
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
    const data = e.dataTransfer.getData("application/fileflow-file");
    if (data) {
      try {
        const fileRef: FileReference = JSON.parse(data);
        insertFileBadge(fileRef);
      } catch {
        // Invalid data, ignore
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
              {chatState.messages.map((message: ChatMessage) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex flex-col p-3 rounded-lg",
                    message.role === "user"
                      ? "bg-slate-100 dark:bg-slate-800 ml-auto max-w-[85%]"
                      : "bg-white dark:bg-slate-900 border mr-auto max-w-[85%]"
                  )}
                >
                  <div className="whitespace-pre-wrap text-sm">
                    {message.role === "assistant"
                      ? parseMessageContent(message.content, onFileSelect)
                      : parseUserMessage(message.content)}
                  </div>

                  {/* Affected files count for assistant messages */}
                  {message.role === "assistant" &&
                    message.metadata?.affected_files &&
                    message.metadata.affected_files.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span>{message.metadata.affected_files.length} file(s) affected</span>
                      </div>
                    )}

                  <div className="flex justify-between items-center mt-2">
                    <div className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                    <div className="flex items-center space-x-2">
                      {message.stats && (
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>{message.stats.input_tokens} in</span>
                          <span>{message.stats.output_tokens} out</span>
                          <span>${message.stats.cost_usd.toFixed(4)}</span>
                          <span>{(message.stats.duration_ms / 1000).toFixed(1)}s</span>
                        </div>
                      )}
                      {message.tokens && !message.stats && (
                        <Badge variant="outline" className="text-xs">
                          {message.tokens} tokens
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Processing indicator */}
              {chatState.isProcessing && (
                <div className="flex flex-col p-3 rounded-lg bg-white dark:bg-slate-900 border mr-auto max-w-[85%]">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="text-sm text-muted-foreground">Processing your request...</span>
                  </div>
                  {chatState.currentAction && (
                    <div className="mt-1.5 text-xs text-muted-foreground/70 pl-6">
                      {chatState.currentAction}
                    </div>
                  )}
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
            "relative rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 transition-colors focus-within:ring-2 focus-within:ring-slate-400 dark:focus-within:ring-slate-600",
            isDragOver && "ring-2 ring-blue-400 bg-blue-50/30 dark:bg-blue-900/10"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div
            ref={editorRef}
            contentEditable={!chatState.isProcessing}
            role="textbox"
            title="Chat message input"
            aria-multiline="true"
            aria-placeholder="What changes do you want to make?"
            className={cn(
              "w-full bg-transparent px-4 py-3 pr-16 text-sm focus:outline-none min-h-[80px] max-h-[200px] overflow-y-auto",
              "empty:before:content-[attr(aria-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none"
            )}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            suppressContentEditableWarning
          />
          <div className="absolute right-2 top-0 bottom-0 flex items-center gap-1">
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
                disabled={false}
                className="rounded-full h-8 w-8 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white"
              >
                <ArrowUp className="h-4 w-4 text-white dark:text-slate-900" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
