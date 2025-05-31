"use client";

import { useState, useCallback, useEffect } from "react";
import { apiClient, type SessionResponse } from "@/features/api/client";
import { useToast } from "@/components/ui/use-toast";
import { getCategories } from "@/features/categories/actions";
import { resetCategoriesOnServer } from "@/features/categories/api";

export interface SessionState {
  sessionId: string | null;
  isCreating: boolean;
  error: string | null;
  affectedFiles: string[];
}

export function useSession() {
  const [sessionState, setSessionState] = useState<SessionState>({
    sessionId: null,
    isCreating: false,
    error: null,
    affectedFiles: [],
  });
  const { toast } = useToast();

  const createSession = useCallback(
    async (folderId: string, workingDirectory?: string) => {
      setSessionState((prev) => ({ ...prev, isCreating: true, error: null }));

      try {
        // First, create the session
        const response = await apiClient.createSession(
          folderId,
          workingDirectory
        );

        // Then, sync categories with the server
        try {
          const categories = await getCategories();
          await resetCategoriesOnServer(categories);
          console.log("Categories synced to server during session creation");
        } catch (categoryError) {
          console.error(
            "Failed to sync categories during session creation:",
            categoryError
          );
          // Don't fail session creation if category sync fails
        }

        setSessionState({
          sessionId: response.session_id,
          isCreating: false,
          error: null,
          affectedFiles: [], // Reset affected files for new session
        });

        toast({
          title: "Session Created",
          description: `New agent session created with ID: ${response.session_id}`,
        });

        return response.session_id;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create session";
        setSessionState((prev) => ({
          ...prev,
          isCreating: false,
          error: errorMessage,
        }));

        toast({
          title: "Session Creation Failed",
          description: errorMessage,
          variant: "destructive",
        });

        throw error;
      }
    },
    [toast]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await apiClient.deleteSession(sessionId);
        setSessionState({
          sessionId: null,
          isCreating: false,
          error: null,
          affectedFiles: [], // Clear affected files when session is deleted
        });

        toast({
          title: "Session Deleted",
          description: "Agent session has been deleted",
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to delete session";
        toast({
          title: "Session Deletion Failed",
          description: errorMessage,
          variant: "destructive",
        });
        throw error;
      }
    },
    [toast]
  );

  const clearSession = useCallback(() => {
    setSessionState({
      sessionId: null,
      isCreating: false,
      error: null,
      affectedFiles: [], // Clear affected files when session is cleared
    });
  }, []);

  const updateAffectedFiles = useCallback((files: string[]) => {
    setSessionState((prev) => ({
      ...prev,
      affectedFiles: files,
    }));
  }, []);

  const clearAffectedFiles = useCallback(() => {
    setSessionState((prev) => ({
      ...prev,
      affectedFiles: [],
    }));
  }, []);

  return {
    sessionState,
    createSession,
    deleteSession,
    clearSession,
    updateAffectedFiles,
    clearAffectedFiles,
  };
}
