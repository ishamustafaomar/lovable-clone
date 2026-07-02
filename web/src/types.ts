export type ProjectStatus =
  | "idle"
  | "generating"
  | "deploying"
  | "ready"
  | "error";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  idle: "Draft",
  generating: "Generating",
  deploying: "Deploying",
  ready: "Live",
  error: "Error",
};

export function isBusy(status: ProjectStatus | undefined): boolean {
  return status === "generating" || status === "deploying";
}

export interface Project {
  id: string;
  name: string;
  icon: string;
  status: ProjectStatus;
  statusMessage: string | null;
  previewUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

export type MessageRole = "user" | "assistant" | "status" | "error";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
}

export interface ProjectFile {
  path: string;
  content: string;
}

export interface ProjectDetail {
  project: Project;
  messages: ChatMessage[];
}
