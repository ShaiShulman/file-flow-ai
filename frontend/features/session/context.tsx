"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useSession, SessionState } from "./hooks";

interface SessionContextType {
  sessionState: SessionState;
  createSession: (
    folderId: string,
    workingDirectory?: string
  ) => Promise<string>;
  updateAffectedFiles: (files: string[]) => void;
  clearAffectedFiles: () => void;
  deleteSession: (sessionId: string) => Promise<void>;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const sessionHook = useSession();

  return (
    <SessionContext.Provider value={sessionHook}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextType {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSessionContext must be used within a SessionProvider");
  }
  return context;
}
