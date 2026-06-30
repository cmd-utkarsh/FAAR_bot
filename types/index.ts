export interface FrontConversation {
  id: string;
  subject: string;
  status: string;
  assignee?: { id: string; email: string; first_name: string; last_name: string };
  recipient?: { name: string; handle: string };
  tags?: Array<{ id: string; name: string }>;
  created_at: number;
  is_private: boolean;
  links: Array<{ self: string; related: { messages: string } }>;
}

export interface FrontMessage {
  id: string;
  type: string;
  is_inbound: boolean;
  subject: string;
  body: string;
  text: string;
  created_at: number;
  author?: { name: string; email: string };
  recipients?: Array<{ name: string; handle: string }>;
}

export interface FrontTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  attachments: unknown[];
  is_available_for_all_inboxes: boolean;
  inbox_ids: string[] | null;
}

export interface FrontSendReplyBody {
  body: string;
  author_id?: string;
  channel_id?: string;
  options: {
    archive: boolean;
    tags?: string[];
  };
}

export interface FrontSendReplyResponse {
  status: "accepted";
  message_uid: string;
}

export interface FrontPagination {
  next?: string;
  prev?: string;
}

export interface FrontListResponse<T> {
  _pagination: FrontPagination;
  _links: { self: string };
  _results: T[];
}

export interface FrontError {
  _error: {
    status: number;
    title: string;
    message: string;
  };
}

export interface FrontStatus {
  id: string;
  name: string;
  category: "open" | "waiting" | "resolved" | "archived";
}

export interface DeepSeekResponse {
  template_id: string;
  template_name: string;
  confidence: number;
  reasoning: string;
}

export interface ProcessResult {
  conversationId: string;
  subjectLine?: string;
  emailSnippet: string;
  selectedTemplate: string;
  templateId: string;
  confidence: number;
  reasoning: string;
  messageUid?: string;
  statusIdApplied?: string;
  status: LogStatus;
  replySentAt?: Date;
}

export type LogStatus = "AUTO_SENT" | "MANUAL_REVIEW" | "MANUALLY_SENT" | "SKIPPED" | "ERROR" | "PENDING";

export interface RateLimitState {
  remaining: number;
  reset: number;
  limit: number;
}

export interface LiveCheckResult {
  checked: number;
  new: number;
  sent: number;
  flagged: number;
}
