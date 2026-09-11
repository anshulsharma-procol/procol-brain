import type { BrainContext, BrainTicket } from "../types/config";
import type { SimilarIssue } from "../types/messages";
import type { BrainApi } from "./brainApi";

const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export class MockBrainApi implements BrainApi {
  async searchSimilarIssues(
    _message: string,
    _context?: BrainContext,
  ): Promise<SimilarIssue> {
    await wait(900);
    return {
      number: "892",
      title: "GST calculation incorrect",
      customer: "XYZ Corp",
      solution:
        "Tenant GST configuration was not being passed to the invoice calculator.",
    };
  }

  async createTicket(
    message: string,
    context?: BrainContext,
  ): Promise<BrainTicket> {
    await wait(350);
    return {
      id: "ticket-1245",
      number: "1245",
      title: message.slice(0, 80),
      status: "investigating",
      context,
    };
  }

  async startInvestigation(_ticket: BrainTicket) {
    await wait(300);
  }

  async getTicketStatus(_ticket: BrainTicket) {
    await wait(450);
    return "resolved" as const;
  }

  async sendMessage(_message: string, _context?: BrainContext) {
    await wait(500);
    return "I can help with that. Tell me a little more about what you are seeing.";
  }
}
