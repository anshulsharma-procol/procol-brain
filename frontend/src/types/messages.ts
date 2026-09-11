export type WorkflowState =
  | "INITIAL"
  | "USER_MESSAGE"
  | "SEARCHING_SIMILAR_ISSUES"
  | "SIMILAR_ISSUE_FOUND"
  | "WAITING_FOR_CONFIRMATION"
  | "INVESTIGATING"
  | "AGENTS_WORKING"
  | "RESOLUTION_READY"
  | "RESOLVED";

export interface BrainMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  status?: "pending";
}

export interface SimilarIssue {
  number: string;
  title: string;
  customer: string;
  solution: string;
}

export interface InvestigationStep {
  label: string;
  agent?: string;
  status: "complete" | "active" | "pending";
}
