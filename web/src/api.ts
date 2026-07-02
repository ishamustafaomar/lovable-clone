import type { Project, ProjectDetail, ProjectFile } from "./types";

const URL_KEY = "forge.backendUrl";
const SECRET_KEY = "forge.apiSecret";

export function getBackendUrl(): string {
  return (
    localStorage.getItem(URL_KEY) ?? import.meta.env.VITE_CONVEX_SITE_URL ?? ""
  );
}

export function setBackendUrl(value: string): void {
  const trimmed = value.trim();
  if (trimmed) localStorage.setItem(URL_KEY, trimmed);
  else localStorage.removeItem(URL_KEY);
}

export function getApiSecret(): string {
  return localStorage.getItem(SECRET_KEY) ?? "";
}

export function setApiSecret(value: string): void {
  const trimmed = value.trim();
  if (trimmed) localStorage.setItem(SECRET_KEY, trimmed);
  else localStorage.removeItem(SECRET_KEY);
}

function normalizedBase(): string {
  let raw = getBackendUrl().trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  return raw.replace(/\/+$/, "");
}

export function isConfigured(): boolean {
  return normalizedBase() !== "";
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = normalizedBase();
  if (!base) {
    throw new ApiError(
      "Backend not configured. Open Settings and enter your Convex deployment URL.",
    );
  }

  const headers: Record<string, string> = {};
  if (init?.body) headers["Content-Type"] = "application/json";
  const secret = getApiSecret();
  if (secret) headers["x-forge-secret"] = secret;

  let response: Response;
  try {
    response = await fetch(base + path, { ...init, headers });
  } catch {
    throw new ApiError(
      "Could not reach the backend. Check the URL and your connection.",
    );
  }

  if (!response.ok) {
    let message = `Server returned status ${response.status}.`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // Non-JSON error body — keep the status message.
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export const api = {
  health(): Promise<{ ok: boolean }> {
    return request("/api/health");
  },

  async listProjects(): Promise<Project[]> {
    const { projects } = await request<{ projects: Project[] }>(
      "/api/projects",
    );
    return projects;
  },

  async createProject(name: string, prompt: string): Promise<string> {
    const { projectId } = await request<{ projectId: string }>(
      "/api/projects",
      { method: "POST", body: JSON.stringify({ name, prompt }) },
    );
    return projectId;
  },

  projectDetail(id: string): Promise<ProjectDetail> {
    return request(`/api/projects/${id}`);
  },

  async projectFiles(id: string): Promise<ProjectFile[]> {
    const { files } = await request<{ files: ProjectFile[] }>(
      `/api/projects/${id}/files`,
    );
    return files;
  },

  sendMessage(id: string, prompt: string): Promise<unknown> {
    return request(`/api/projects/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
  },

  wakeProject(id: string): Promise<unknown> {
    return request(`/api/projects/${id}/wake`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  deleteProject(id: string): Promise<unknown> {
    return request(`/api/projects/${id}`, { method: "DELETE" });
  },
};
