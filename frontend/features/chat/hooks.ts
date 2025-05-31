"use client";

import { useState, useCallback, useRef } from "react";
import {
  apiClient,
  type AgentResponse,
  type UserInput,
} from "@/features/api/client";
import { useToast } from "@/components/ui/use-toast";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tokens?: number;
  timestamp: Date;
  metadata?: {
    affected_files?: string[];
    actions?: Array<Record<string, any>>;
    file_metadata?: Record<string, any>;
    categories?: Record<string, any>;
  };
}

export interface ChatState {
  messages: ChatMessage[];
  isProcessing: boolean;
  error: string | null;
  totalTokens: number;
}

export function useChat(
  sessionId: string | null,
  updateAffectedFiles?: (files: string[]) => void,
  onFolderStructureChange?: (affectedFiles?: string[]) => void
) {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isProcessing: false,
    error: null,
    totalTokens: 0,
  });
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (message: string, workingDirectory?: string) => {
      if (!sessionId) {
        toast({
          title: "No Session",
          description: "Please upload a file to create a session first",
          variant: "destructive",
        });
        return;
      }

      if (!message.trim()) return;

      // Create user message
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: message,
        timestamp: new Date(),
      };

      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isProcessing: true,
        error: null,
      }));

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        const userInput: UserInput = {
          message,
          working_directory: workingDirectory,
        };

        const response = await apiClient.runAgent(sessionId, userInput);

        // Create assistant message
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response.message || "I've processed your request.",
          tokens: response.analysis_tokens + response.instruction_tokens,
          timestamp: new Date(),
          metadata: {
            affected_files: response.affected_files,
            actions: response.actions,
            file_metadata: response.file_metadata,
            categories: response.categories,
          },
        };

        setChatState((prev) => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isProcessing: false,
          totalTokens:
            prev.totalTokens +
            (response.analysis_tokens + response.instruction_tokens),
        }));

        // Update session affected files if callback provided
        if (updateAffectedFiles && response.affected_files.length > 0) {
          console.log(
            "[CHAT-HOOKS] Updating affected files:",
            response.affected_files
          );
          updateAffectedFiles(response.affected_files);
        }

        // Trigger folder structure rescan if files were affected
        if (onFolderStructureChange && response.affected_files.length > 0) {
          console.log(
            "[CHAT-HOOKS] Triggering folder structure rescan. Affected files:",
            response.affected_files.length
          );
          onFolderStructureChange(response.affected_files);
        }

        // Show success toast if files were affected
        if (response.affected_files.length > 0) {
          console.log(
            "[CHAT-HOOKS] Files were affected, showing success toast"
          );
          toast({
            title: "Files Updated",
            description: `${response.affected_files.length} file(s) were modified`,
          });
        } else {
          console.log("[CHAT-HOOKS] No files were affected by this response");
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Request was aborted, don't show error
          return;
        }

        const errorMessage =
          error instanceof Error ? error.message : "Failed to send message";
        setChatState((prev) => ({
          ...prev,
          isProcessing: false,
          error: errorMessage,
        }));

        toast({
          title: "Message Failed",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        abortControllerRef.current = null;
      }
    },
    [sessionId, toast, updateAffectedFiles, onFolderStructureChange]
  );

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setChatState((prev) => ({
        ...prev,
        isProcessing: false,
      }));

      toast({
        title: "Generation Stopped",
        description: "The response generation has been stopped.",
      });
    }
  }, [toast]);

  const clearMessages = useCallback(() => {
    setChatState((prev) => ({
      ...prev,
      messages: [],
      error: null,
    }));
  }, []);

  const getTokenStats = useCallback(async () => {
    if (!sessionId) return null;

    try {
      const stats = await apiClient.getTokenStats(sessionId);
      setChatState((prev) => ({
        ...prev,
        totalTokens: stats.total_tokens,
      }));
      return stats;
    } catch (error) {
      console.error("Failed to get token stats:", error);
      return null;
    }
  }, [sessionId]);

  return {
    chatState,
    sendMessage,
    stopGeneration,
    clearMessages,
    getTokenStats,
  };
}
