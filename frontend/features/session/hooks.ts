"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { apiClient, type SessionResponse } from "@/features/api/client";
import { useToast } from "@/components/ui/use-toast";
import { getCategories } from "@/features/categories/actions";
import { resetCategoriesOnServer } from "@/features/categories/api";

export interface SessionState {
  sessionId: string | null;
  isCreating: boolean;
  error: string | null;
  affectedFiles: string[];
  fileChangeTypes: Record<string, string>;
  allFileMetadata: Record<string, Record<string, any>>;
  recentlyAffectedFiles: string[];
}

export function useSession() {
  const [sessionState, setSessionState] = useState<SessionState>({
    sessionId: null,
    isCreating: false,
    error: null,
    affectedFiles: [],
    fileChangeTypes: {},
    allFileMetadata: {},
    recentlyAffectedFiles: [],
  });
  const { toast } = useToast();
  const recentTimerRef = useRef<NodeJS.Timeout | null>(null);

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
          // Categories synced successfully
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
          affectedFiles: [],
          fileChangeTypes: {},
          allFileMetadata: {},
          recentlyAffectedFiles: [],
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
          affectedFiles: [],
          fileChangeTypes: {},
          allFileMetadata: {},
          recentlyAffectedFiles: [],
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
      affectedFiles: [],
      fileChangeTypes: {},
      allFileMetadata: {},
      recentlyAffectedFiles: [],
    });
  }, []);

  const updateAffectedFiles = useCallback((files: string[]) => {
    setSessionState((prev) => ({
      ...prev,
      affectedFiles: files,
      recentlyAffectedFiles: files,
    }));

    // Clear recently affected files after 5 seconds
    if (recentTimerRef.current) {
      clearTimeout(recentTimerRef.current);
    }
    recentTimerRef.current = setTimeout(() => {
      setSessionState((prev) => ({
        ...prev,
        recentlyAffectedFiles: [],
      }));
    }, 5000);
  }, []);

  const clearAffectedFiles = useCallback(() => {
    setSessionState((prev) => ({
      ...prev,
      affectedFiles: [],
    }));
  }, []);

  const updateFileChangeTypes = useCallback((changeTypes: Record<string, string>) => {
    setSessionState((prev) => ({
      ...prev,
      fileChangeTypes: { ...prev.fileChangeTypes, ...changeTypes },
    }));
  }, []);

  const updateAllFileMetadata = useCallback((metadata: Record<string, Record<string, any>>) => {
    setSessionState((prev) => ({
      ...prev,
      allFileMetadata: { ...prev.allFileMetadata, ...metadata },
    }));
  }, []);

  const restoreSession = useCallback(
    async (sessionId: string): Promise<string> => {
      setSessionState((prev) => ({ ...prev, isCreating: true, error: null }));

      try {
        // Verify session exists and get working directory
        const detail = await apiClient.getSessionDetail(sessionId);

        // Rebuild fileChangeTypes from action history
        const { actions } = await apiClient.getActions(sessionId);
        const fileChangeTypes: Record<string, string> = {};
        for (const action of actions) {
          const path = action.item_path || action.item_name || "";
          const actionType = action.action_type || "";
          if (path && actionType && !action.reverted) {
            fileChangeTypes[path] = actionType;
          }
        }

        // Get all file metadata
        const manifest = await apiClient.getManifest(sessionId);
        const allFileMetadata: Record<string, Record<string, any>> = manifest.metadata || {};

        setSessionState({
          sessionId,
          isCreating: false,
          error: null,
          affectedFiles: [],
          fileChangeTypes,
          allFileMetadata,
          recentlyAffectedFiles: [],
        });

        toast({
          title: "Session Restored",
          description: `Reconnected to session ${sessionId}`,
        });

        return detail.working_directory;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to restore session";
        setSessionState((prev) => ({
          ...prev,
          isCreating: false,
          error: errorMessage,
        }));

        toast({
          title: "Session Restoration Failed",
          description: errorMessage,
          variant: "destructive",
        });

        throw error;
      }
    },
    [toast]
  );

  return {
    sessionState,
    createSession,
    deleteSession,
    clearSession,
    restoreSession,
    updateAffectedFiles,
    clearAffectedFiles,
    updateFileChangeTypes,
    updateAllFileMetadata,
  };
}
