const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface UserInput {
  message: string;
  working_directory?: string;
}

export interface AgentResponse {
  message?: string;
  working_directory: string;
  affected_files: string[];
  analysis_tokens: number;
  instruction_tokens: number;
  actions: Array<Record<string, any>>;
  file_metadata: Record<string, any>;
  categories: Record<string, any>;
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

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

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

  // Health check
  async healthCheck(): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>("/");
  }
}

// Export a default instance
export const apiClient = new ApiClient();
