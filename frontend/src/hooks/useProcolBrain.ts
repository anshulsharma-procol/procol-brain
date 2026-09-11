import { useCallback, useRef, useState } from "react";
import type { BrainContext, BrainTicket } from "../types/config";
import type { BrainApi } from "../services/brainApi";
import type {
  BrainMessage,
  InvestigationStep,
  SimilarIssue,
  WorkflowState,
} from "../types/messages";

const assistant = (content: string): BrainMessage => ({
  id: crypto.randomUUID(),
  role: "assistant",
  content,
});
const user = (content: string): BrainMessage => ({
  id: crypto.randomUUID(),
  role: "user",
  content,
});

export function useProcolBrain(
  api: BrainApi,
  context?: BrainContext,
  onTicketResolved?: (ticket: BrainTicket) => void,
) {
  const [state, setState] = useState<WorkflowState>("INITIAL");
  const [messages, setMessages] = useState<BrainMessage[]>([
    assistant(
      "Hi! I'm Procol Brain.\nDescribe your issue and I'll help you find a solution.",
    ),
  ]);
  const [similarIssue, setSimilarIssue] = useState<SimilarIssue | null>(null);
  const [ticket, setTicket] = useState<BrainTicket | null>(null);
  const [investigationSteps, setInvestigationSteps] = useState<
    InvestigationStep[]
  >([]);
  const runId = useRef(0);

  const sendMessage = useCallback(
    async (content: string) => {
      const message = content.trim();
      if (!message || state !== "INITIAL") return;
      const currentRun = ++runId.current;
      setMessages((current) => [...current, user(message)]);
      setState("USER_MESSAGE");
      setState("SEARCHING_SIMILAR_ISSUES");
      setMessages((current) => [
        ...current,
        assistant(
          "Thanks for reporting this. Let me check if we've solved a similar issue before.",
        ),
      ]);
      const match = await api.searchSimilarIssues(message, context);
      if (currentRun !== runId.current) return;
      setSimilarIssue(match);
      setState(match ? "SIMILAR_ISSUE_FOUND" : "INVESTIGATING");
      setMessages((current) => [
        ...current,
        assistant(
          match
            ? "I found a similar resolved issue."
            : "I couldn't find a close match, so I'll start an investigation.",
        ),
      ]);
      if (!match) await beginInvestigation(message);
    },
    [api, context, state],
  );

  const confirmSolution = useCallback(
    async (resolved: boolean) => {
      if (!similarIssue) return;
      if (resolved) {
        const resolvedTicket: BrainTicket = {
          id: "ticket-1245",
          number: "1245",
          title: similarIssue.title,
          status: "resolved",
          context,
        };
        setTicket(resolvedTicket);
        setState("RESOLVED");
        setMessages((current) => [
          ...current,
          user("Yes, this helps."),
          assistant(
            "Great! I'm glad we could help. Ticket #1245 has been marked as resolved.",
          ),
        ]);
        onTicketResolved?.(resolvedTicket);
        return;
      }
      setMessages((current) => [
        ...current,
        user("No, investigate further."),
        assistant(
          "Understood. I'll start a new investigation with our agent team.",
        ),
      ]);
      await beginInvestigation(similarIssue.title);
    },
    [context, onTicketResolved, similarIssue],
  );

  const beginInvestigation = async (message: string) => {
    setState("INVESTIGATING");
    const createdTicket = await api.createTicket(message, context);
    setTicket(createdTicket);
    await api.startInvestigation(createdTicket);
    setState("AGENTS_WORKING");
    setInvestigationSteps([
      { label: "Understanding the issue", status: "complete" },
      { label: "Fetching product context", agent: "Clara", status: "complete" },
      {
        label: "Investigating code",
        agent: "Development Agent",
        status: "active",
      },
      { label: "Running validation", agent: "QA Agent", status: "pending" },
      { label: "Waiting for approval", agent: "Manager", status: "pending" },
    ]);
    await new Promise((resolve) => window.setTimeout(resolve, 1300));
    setInvestigationSteps((steps) =>
      steps.map((step, index) => ({
        ...step,
        status: index < 3 ? "complete" : index === 3 ? "active" : "pending",
      })),
    );
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    setInvestigationSteps((steps) =>
      steps.map((step) => ({ ...step, status: "complete" })),
    );
    setState("RESOLUTION_READY");
    setMessages((current) => [
      ...current,
      assistant("Your issue has been fixed and is ready for approval."),
    ]);
  };

  const reset = () => {
    setState("INITIAL");
    setMessages([
      assistant(
        "Hi! I'm Procol Brain.\nDescribe your issue and I'll help you find a solution.",
      ),
    ]);
    setSimilarIssue(null);
    setTicket(null);
    setInvestigationSteps([]);
  };

  return {
    state,
    messages,
    similarIssue,
    ticket,
    investigationSteps,
    sendMessage,
    confirmSolution,
    reset,
  };
}
