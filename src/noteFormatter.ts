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
  const suggestedReply = result.suggestedReply
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  const checklist = result.checklist
    .map((item, index) => `${index + 1}. ${item}`)
    .join('\n');

  return [
    '**Postmaster Triage**',
    '',
    `- **Category:** ${CATEGORY_LABELS[result.category]}`,
    '',
    `- **Priority:** ${PRIORITY_LABELS[result.priority]}`,
    '',
    `- **Reason:** ${result.reasoning}`,
    '',
    '**Suggested Reply**',
    '',
    suggestedReply,
    '',
    '**Moderator Checklist**',
    '',
    checklist,
    '',
    '_Moderator note only. Postmaster does not send user-visible replies._',
  ].join('\n');
}
