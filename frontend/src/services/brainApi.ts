import type { BrainContext, BrainTicket } from "../types/config";
import type { SimilarIssue } from "../types/messages";

export interface BrainApi {
  searchSimilarIssues(
    message: string,
    context?: BrainContext,
  ): Promise<SimilarIssue | null>;
  createTicket(message: string, context?: BrainContext): Promise<BrainTicket>;
  startInvestigation(ticket: BrainTicket): Promise<void>;
  getTicketStatus(ticket: BrainTicket): Promise<"investigating" | "resolved">;
  sendMessage(message: string, context?: BrainContext): Promise<string>;
}

export interface BrainClientOptions {
  baseUrl?: string;
}

export const createBrainClient = (
  _options: BrainClientOptions = {},
): BrainApi => {
  throw new Error(
    "A real BrainApi adapter is not configured yet. Use MockBrainApi for the demo.",
  );
};
