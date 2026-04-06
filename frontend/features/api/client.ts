const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface UserInput {
  message: string;
  working_directory?: string;
}

export interface MessageStats {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  duration_ms: number;
}

export interface ClarificationQuestion {
  question: string;
  options: string[];
  allow_multiple: boolean;
}

export interface AgentResponse {
  message?: string;
  working_directory: string;
  affected_files: string[];
  last_affected_files: string[];
  analysis_tokens: number;
  instruction_tokens: number;
  actions: Array<Record<string, any>>;
  file_metadata: Record<string, any>;
  categories: Record<string, any>;
  message_stats?: MessageStats;
  file_id_map: Record<string, string>; // path -> stable file ID
  clarification?: ClarificationQuestion;
}

export interface TokenStats {
  analysis_tokens: number;
  instruction_tokens: number;
  total_tokens: number;
}

export interface SessionResponse {
  session_id: string;
}

export interface CategoryResponse {
  status: string;
  values?: string[];
}

export interface FileActionResponse {
  success: boolean;
  message: string;
  action: Record<string, any>;
  affected_files: string[];
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });
    } catch {
      throw new Error(
        `Cannot connect to backend at ${this.baseUrl}. Make sure the server is running.`
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  // Session management
  async createSession(
    sessionId?: string,
    workingDirectory?: string
  ): Promise<SessionResponse> {
    if (sessionId) {
      return this.request<SessionResponse>(`/sessions/${sessionId}`, {
        method: "POST",
        body: JSON.stringify({ working_directory: workingDirectory }),
      });
    } else {
      return this.request<SessionResponse>("/sessions", {
        method: "POST",
        body: JSON.stringify({
          working_directory: workingDirectory,
          session_id: sessionId,
        }),
      });
    }
  }

  async deleteSession(sessionId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/sessions/${sessionId}`, {
      method: "DELETE",
    });
  }

  async listSessions(): Promise<string[]> {
    return this.request<string[]>("/sessions");
  }

  async getSessionDetail(
    sessionId: string
  ): Promise<{ id: string; working_directory: string; created_at: string; status: string }> {
    return this.request<{ id: string; working_directory: string; created_at: string; status: string }>(
      `/sessions/${sessionId}/detail`
    );
  }

  async getSessionStatus(
    sessionId: string
  ): Promise<{
    status: string;
    current_action: string;
    progress: { current: number; total: number; current_file: string } | null;
  }> {
    return this.request<{
      status: string;
      current_action: string;
      progress: { current: number; total: number; current_file: string } | null;
    }>(`/sessions/${sessionId}/status`);
  }

  // Folder structure with stable IDs
  async getFolderStructure(
    sessionId: string
  ): Promise<import("@/lib/types").FolderType> {
    return this.request<import("@/lib/types").FolderType>(
      `/sessions/${sessionId}/folder-structure`
    );
  }

  // Agent interaction
  async runAgent(
    sessionId: string,
    userInput: UserInput
  ): Promise<AgentResponse> {
    return this.request<AgentResponse>(`/sessions/${sessionId}/run`, {
      method: "POST",
      body: JSON.stringify(userInput),
    });
  }

  async getTokenStats(sessionId: string): Promise<TokenStats> {
    return this.request<TokenStats>(`/stats/tokens/${sessionId}`);
  }

  // Categories management
  async getCategories(): Promise<Record<string, string[]>> {
    return this.request<Record<string, string[]>>("/categories");
  }

  async getCategory(name: string): Promise<CategoryResponse> {
    return this.request<CategoryResponse>(`/categories/${name}`);
  }

  async addOrUpdateCategory(
    name: string,
    values: string[]
  ): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>(
      `/categories/${name}`,
      {
        method: "POST",
        body: JSON.stringify(values),
      }
    );
  }

  async deleteCategory(
    name: string
  ): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>(
      `/categories/${name}`,
      {
        method: "DELETE",
      }
    );
  }

  async clearAllCategories(): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>("/categories", {
      method: "DELETE",
    });
  }

  async resetCategories(
    categories: Record<string, string[]>
  ): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>(
      "/categories/reset",
      {
        method: "PUT",
        body: JSON.stringify(categories),
      }
    );
  }

  // Settings
  async getExactMatch(): Promise<{ enabled: boolean }> {
    return this.request<{ enabled: boolean }>("/settings/exact-match");
  }

  async setExactMatch(enabled: boolean): Promise<{ enabled: boolean }> {
    return this.request<{ enabled: boolean }>("/settings/exact-match", {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>("/");
  }

  // Action history
  async getActions(
    sessionId: string
  ): Promise<{ actions: Array<Record<string, any>> }> {
    return this.request<{ actions: Array<Record<string, any>> }>(
      `/sessions/${sessionId}/actions`
    );
  }

  async checkRevert(
    sessionId: string,
    actionId: number
  ): Promise<{ can_revert: boolean; message: string; description: string }> {
    return this.request<{ can_revert: boolean; message: string; description: string }>(
      `/sessions/${sessionId}/actions/${actionId}/check-revert`
    );
  }

  async revertAction(
    sessionId: string,
    actionId: number
  ): Promise<{ success: boolean; message: string; revert_message?: string }> {
    return this.request<{ success: boolean; message: string; revert_message?: string }>(
      `/sessions/${sessionId}/actions/${actionId}/revert`,
      { method: "POST" }
    );
  }

  // File metadata
  async getFileMetadata(
    sessionId: string,
    filePath: string
  ): Promise<{ file_path: string; metadata: Record<string, any> }> {
    return this.request<{ file_path: string; metadata: Record<string, any> }>(
      `/sessions/${sessionId}/metadata/${encodeURIComponent(filePath)}`
    );
  }

  async updateFileMetadata(
    sessionId: string,
    filePath: string,
    metadata: Record<string, any>
  ): Promise<{ status: string }> {
    return this.request<{ status: string }>(
      `/sessions/${sessionId}/metadata/${encodeURIComponent(filePath)}`,
      { method: "PUT", body: JSON.stringify(metadata) }
    );
  }

  // Metadata field definitions
  async getMetadataFields(
    sessionId: string
  ): Promise<{ fields: Array<{ field_name: string; field_type: string }> }> {
    return this.request<{
      fields: Array<{ field_name: string; field_type: string }>;
    }>(`/sessions/${sessionId}/metadata-fields`);
  }

  async addMetadataField(
    sessionId: string,
    name: string,
    type: string = "text"
  ): Promise<{ status: string }> {
    return this.request<{ status: string }>(
      `/sessions/${sessionId}/metadata-fields`,
      { method: "POST", body: JSON.stringify({ name, type }) }
    );
  }

  async deleteMetadataField(
    sessionId: string,
    fieldName: string
  ): Promise<{ status: string }> {
    return this.request<{ status: string }>(
      `/sessions/${sessionId}/metadata-fields/${encodeURIComponent(fieldName)}`,
      { method: "DELETE" }
    );
  }

  // Session stats / analytics
  async getSessionStats(sessionId: string): Promise<Record<string, any>> {
    return this.request<Record<string, any>>(
      `/sessions/${sessionId}/stats`
    );
  }

  // Session messages
  async getSessionMessages(
    sessionId: string
  ): Promise<{ messages: Array<Record<string, any>> }> {
    return this.request<{ messages: Array<Record<string, any>> }>(
      `/sessions/${sessionId}/messages`
    );
  }

  // Script export
  async exportScript(
    sessionId: string,
    basePath: string,
    format: string = "powershell"
  ): Promise<{ script: string; filename: string }> {
    return this.request<{ script: string; filename: string }>(
      `/sessions/${sessionId}/export-script`,
      {
        method: "POST",
        body: JSON.stringify({ base_path: basePath, format }),
      }
    );
  }

  // Manifest
  async getManifest(sessionId: string): Promise<Record<string, any>> {
    return this.request<Record<string, any>>(
      `/sessions/${sessionId}/manifest`
    );
  }

  // Manual file operations
  async deleteFile(
    sessionId: string,
    path: string,
    itemType?: string
  ): Promise<FileActionResponse> {
    return this.request<FileActionResponse>(
      `/sessions/${sessionId}/files/delete`,
      {
        method: "POST",
        body: JSON.stringify({ path, item_type: itemType }),
      }
    );
  }

  async moveFile(
    sessionId: string,
    sourcePath: string,
    destPath: string
  ): Promise<FileActionResponse> {
    return this.request<FileActionResponse>(
      `/sessions/${sessionId}/files/move`,
      {
        method: "POST",
        body: JSON.stringify({ source_path: sourcePath, dest_path: destPath }),
      }
    );
  }

  async createFolder(
    sessionId: string,
    name: string,
    parentPath?: string
  ): Promise<FileActionResponse> {
    return this.request<FileActionResponse>(
      `/sessions/${sessionId}/files/create-folder`,
      {
        method: "POST",
        body: JSON.stringify({ name, parent_path: parentPath }),
      }
    );
  }
}

// Export a default instance
export const apiClient = new ApiClient();
