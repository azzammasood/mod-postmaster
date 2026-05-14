import type { ClassificationResult, ModmailCategory, Priority } from './types.js';

const CATEGORY_LABELS: Record<ModmailCategory, string> = {
  ban_appeal: 'Ban Appeal',
  rule_question: 'Rule Question',
  harassment_report: 'Harassment Report',
  spam: 'Spam',
  general: 'General',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: '🔴 Urgent',
  normal: '🟡 Normal',
  low: '🟢 Low',
};

export function formatModNote(result: ClassificationResult): string {
  const checklist = result.checklist
    .map((item, index) => `${index + 1}) ${item}`)
    .join('\n\n');

  return [
    'POSTMASTER TRIAGE',
    '=================',
    '',
    `CATEGORY: ${CATEGORY_LABELS[result.category]}`,
    '',
    `PRIORITY: ${PRIORITY_LABELS[result.priority]}`,
    '',
    `REASON: ${result.reasoning}`,
    '',
    'SUGGESTED REPLY',
    '---------------',
    '',
    result.suggestedReply,
    '',
    'MODERATOR CHECKLIST',
    '-------------------',
    '',
    checklist,
    '',
    'Moderator note only. Postmaster does not send user-visible replies.',
  ].join('\n');
}
