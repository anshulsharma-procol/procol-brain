export type BrainPosition = "bottom-right" | "bottom-left";

export interface BrainContext {
  currentPage?: string;
  currentModule?: string;
  recordId?: string;
  [key: string]: string | undefined;
}

export interface ProcolBrainTheme {
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderRadius?: number;
  fontFamily?: string;
}

export interface ProcolBrainProps {
  companyId: string;
  userId?: string;
  apiBaseUrl?: string;
  theme?: ProcolBrainTheme;
  position?: BrainPosition;
  defaultOpen?: boolean;
  assistantName?: string;
  logo?: string;
  launcherIcon?: string;
  context?: BrainContext;
  onTicketCreated?: (ticket: BrainTicket) => void;
  onTicketResolved?: (ticket: BrainTicket) => void;
}

export interface BrainTicket {
  id: string;
  number: string;
  title: string;
  status: "resolved" | "investigating";
  context?: BrainContext;
}
