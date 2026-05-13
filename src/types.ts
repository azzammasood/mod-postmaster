export type ModmailCategory =
  | 'ban_appeal'
  | 'rule_question'
  | 'harassment_report'
  | 'spam'
  | 'general';

export type Priority = 'urgent' | 'normal' | 'low';

export type ReplyTone = 'Professional' | 'Friendly' | 'Strict';

export type ClassificationResult = {
  category: ModmailCategory;
  priority: Priority;
  reasoning: string;
  matchedKeywords: string[];
  suggestedReply: string;
  checklist: string[];
};

export type ClassifierConfig = {
  subredditRules: string;
  replyTone: ReplyTone;
  keywordSets: Record<ModmailCategory, string[]>;
};

export type LogEntry = {
  timestamp: number;
  category: ModmailCategory;
  priority: Priority;
  conversationId: string;
};
