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
  isError?: boolean;
  metadata?: {
    affected_files?: string[];
    last_affected_files?: string[];
    actions?: Array<Record<string, any>>;
    file_metadata?: Record<string, any>;
    categories?: Record<string, any>;
  };
  stats?: {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    duration_ms: number;
  };
}

export interface ProgressInfo {
  current: number;
  total: number;
  current_file: string;
}

export interface ChatState {
  messages: ChatMessage[];
  isProcessing: boolean;
  currentAction: string;
  progress: ProgressInfo | null;
  error: string | null;
  totalTokens: number;
}

export function useChat(
  sessionId: string | null,
  updateAffectedFiles?: (files: string[], lastAffectedFiles?: string[]) => void,
  onFolderStructureChange?: (affectedFiles?: string[], lastAffectedFiles?: string[]) => void,
  onResponseData?: (data: { actions: Array<Record<string, any>>; file_metadata: Record<string, any>; file_id_map?: Record<string, string> }) => void
) {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isProcessing: false,
    currentAction: "",
    progress: null,
    error: null,
    totalTokens: 0,
  });
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

      // Start polling for agent status and progress
      pollingRef.current = setInterval(async () => {
        try {
          const status = await apiClient.getSessionStatus(sessionId);
          setChatState((prev) => ({
            ...prev,
            currentAction: status.current_action || prev.currentAction,
            progress: status.progress || null,
          }));
        } catch {
          // Polling failure is non-critical, ignore
        }
      }, 1500);

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
            last_affected_files: response.last_affected_files,
            actions: response.actions,
            file_metadata: response.file_metadata,
            categories: response.categories,
          },
          stats: response.message_stats || undefined,
        };

        setChatState((prev) => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          totalTokens:
            prev.totalTokens +
            (response.analysis_tokens + response.instruction_tokens),
        }));

        // Post-processing: update file explorer, trigger rescans, show toast
        // Wrapped in try/catch so a callback error doesn't mask the successful response
        try {
          // Send actions and metadata to parent for file explorer updates
          if (onResponseData && (response.actions.length > 0 || Object.keys(response.file_metadata).length > 0)) {
            onResponseData({
              actions: response.actions,
              file_metadata: response.file_metadata,
              file_id_map: response.file_id_map,
            });
          }

          // Update session affected files if callback provided
          if (updateAffectedFiles && response.affected_files.length > 0) {
            updateAffectedFiles(response.affected_files, response.last_affected_files);
          }

          // Trigger folder structure rescan if files were affected
          if (onFolderStructureChange && response.affected_files.length > 0) {
            onFolderStructureChange(response.affected_files, response.last_affected_files);
          }

          // Show success toast if files were affected
          if (response.last_affected_files.length > 0) {
            const uniqueCount = new Set(
              response.last_affected_files.map((p) => p.split(/[\\/]/).pop() || p)
            ).size;
            toast({
              title: "Files Updated",
              description: `${uniqueCount} file(s) were modified`,
            });
          }
        } catch (processingError) {
          console.error("Error processing response callbacks:", processingError);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Request was aborted, don't show error
          return;
        }

        const errorMessage =
          error instanceof Error ? error.message : "Failed to send message";

        // Extract a cleaner error message from API responses
        let displayMessage = errorMessage;
        try {
          // API errors come as "API request failed: 500 {"detail":"..."}"
          const jsonMatch = errorMessage.match(/\{.*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.detail) displayMessage = parsed.detail;
          }
        } catch {
          // Use original message if parsing fails
        }

        const errorChatMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: displayMessage,
          timestamp: new Date(),
          isError: true,
        };

        setChatState((prev) => ({
          ...prev,
          messages: [...prev.messages, errorChatMessage],
          error: errorMessage,
        }));
      } finally {
        // Stop status polling and reset processing state
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setChatState((prev) => ({ ...prev, currentAction: "", progress: null, isProcessing: false }));
        abortControllerRef.current = null;
      }
    },
    [sessionId, toast, updateAffectedFiles, onFolderStructureChange, onResponseData]
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

  const loadMessages = useCallback(async () => {
    if (!sessionId) return;

    try {
      const { messages } = await apiClient.getSessionMessages(sessionId);
      const chatMessages: ChatMessage[] = messages.map(
        (msg: Record<string, any>, index: number) => ({
          id: `restored-${index}`,
          role: msg.role as "user" | "assistant",
          content: msg.content || "",
          timestamp: new Date(msg.created_at),
          stats:
            msg.role === "assistant" && (msg.input_tokens || msg.output_tokens)
              ? {
                  input_tokens: msg.input_tokens || 0,
                  output_tokens: msg.output_tokens || 0,
                  cost_usd: msg.cost_usd || 0,
                  duration_ms: msg.duration_ms || 0,
                }
              : undefined,
        })
      );

      setChatState((prev) => ({
        ...prev,
        messages: chatMessages,
        error: null,
      }));
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }, [sessionId]);

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
    loadMessages,
    getTokenStats,
  };
}
