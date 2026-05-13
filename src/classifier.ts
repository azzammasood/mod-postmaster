import type {
  ClassificationResult,
  ClassifierConfig,
  ModmailCategory,
  Priority,
  ReplyTone,
} from './types.js';

const CATEGORY_ORDER: ModmailCategory[] = [
  'harassment_report',
  'ban_appeal',
  'rule_question',
  'spam',
  'general',
];

const STRONG_HARASSMENT_TERMS = ['threat', 'doxx', 'stalking', 'slur', 'hate'];
const URGENT_APPEAL_TERMS = ['urgent', 'wrongfully', 'mistake', 'please review', 'mod abuse'];
const GENERAL_NORMAL_TERMS = ['help', 'question', 'issue'];

const CHECKLISTS: Record<ModmailCategory, string[]> = {
  ban_appeal: [
    'Review original ban/removal reason.',
    'Check user history and prior mod notes.',
    'Decide whether to uphold, reduce, or reverse the action.',
  ],
  rule_question: [
    'Check the rule the user is asking about.',
    'Confirm whether the rule applies to their situation.',
    'Reply with a concise clarification or link to rules.',
  ],
  harassment_report: [
    'Review linked content or usernames.',
    'Check for threats, doxxing, or repeated abuse.',
    'Escalate with Reddit safety tools if needed.',
  ],
  spam: [
    'Check whether sender is promoting a product/service.',
    'Review recent posting history.',
    'Apply subreddit self-promotion rules consistently.',
  ],
  general: [
    'Identify the user’s request.',
    'Check whether another mod already replied.',
    'Respond or archive if no follow-up is needed.',
  ],
};

const BASE_REPLIES: Record<ModmailCategory, string> = {
  ban_appeal:
    'Thanks for reaching out. A moderator will review your appeal and the original action. Please avoid sending repeat messages while the team reviews.',
  rule_question:
    'Thanks for asking. Please review the subreddit rules, especially: {{rules}}. A moderator can clarify if needed.',
  harassment_report:
    'Thanks for reporting this. The moderation team will review the situation. If there is an immediate safety concern, please also use Reddit’s report tools.',
  spam:
    'Thanks for contacting the moderators. If this is about promotion or advertising, please review the subreddit’s self-promotion and spam rules before posting.',
  general:
    'Thanks for reaching out. A moderator will review your message and respond if follow-up is needed.',
};

export function classifyModmail(
  messageBody: string,
  config: ClassifierConfig,
): ClassificationResult {
  const normalizedBody = normalize(messageBody);
  const matchesByCategory = getMatchesByCategory(normalizedBody, config);
  const category = selectCategory(matchesByCategory);
  const matchedKeywords = matchesByCategory[category] ?? [];
  const priority = getPriority(category, normalizedBody);
  const suggestedReply = applyTone(buildReply(category, config.subredditRules), config.replyTone);
  const reasoning = buildReasoning(category, matchedKeywords);

  return {
    category,
    priority,
    reasoning,
    matchedKeywords,
    suggestedReply,
    checklist: CHECKLISTS[category],
  };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function getMatchesByCategory(
  normalizedBody: string,
  config: ClassifierConfig,
): Record<ModmailCategory, string[]> {
  return CATEGORY_ORDER.reduce(
    (matches, category) => {
      const keywords = config.keywordSets[category] ?? [];
      matches[category] = keywords
        .map((keyword) => normalize(keyword))
        .filter(Boolean)
        .filter((keyword) => normalizedBody.includes(keyword));
      return matches;
    },
    {} as Record<ModmailCategory, string[]>,
  );
}

function selectCategory(matchesByCategory: Record<ModmailCategory, string[]>): ModmailCategory {
  let bestCategory: ModmailCategory = 'general';
  let bestScore = 0;

  for (const category of CATEGORY_ORDER) {
    const score = matchesByCategory[category]?.length ?? 0;
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestCategory : 'general';
}

function getPriority(category: ModmailCategory, normalizedBody: string): Priority {
  if (category === 'harassment_report') {
    return containsAny(normalizedBody, STRONG_HARASSMENT_TERMS) ? 'urgent' : 'normal';
  }

  if (category === 'ban_appeal') {
    return containsAny(normalizedBody, URGENT_APPEAL_TERMS) ? 'urgent' : 'normal';
  }

  if (category === 'rule_question') {
    return 'normal';
  }

  if (category === 'spam') {
    return 'low';
  }

  return normalizedBody.length > 240 || containsAny(normalizedBody, GENERAL_NORMAL_TERMS)
    ? 'normal'
    : 'low';
}

function containsAny(normalizedBody: string, terms: string[]): boolean {
  return terms.some((term) => normalizedBody.includes(term));
}

function buildReply(category: ModmailCategory, subredditRules: string): string {
  const fallbackRules = 'the community rules';
  return BASE_REPLIES[category].replace('{{rules}}', subredditRules.trim() || fallbackRules);
}

function applyTone(reply: string, tone: ReplyTone): string {
  if (tone === 'Friendly') {
    return reply
      .replace('Thanks for reaching out.', 'Thanks for reaching out. We appreciate the context.')
      .replace('Thanks for asking.', 'Thanks for asking. Happy to help clarify.')
      .replace('Thanks for reporting this.', 'Thanks for reporting this. We appreciate you flagging it.')
      .replace('Thanks for contacting the moderators.', 'Thanks for contacting the moderators.');
  }

  if (tone === 'Strict') {
    return reply
      .replace('Thanks for reaching out. ', '')
      .replace('Thanks for asking. ', '')
      .replace('Thanks for reporting this. ', '')
      .replace('Thanks for contacting the moderators. ', '')
      .replace('A moderator can clarify if needed.', 'A moderator may clarify if needed.');
  }

  return reply;
}

function buildReasoning(category: ModmailCategory, matchedKeywords: string[]): string {
  if (matchedKeywords.length === 0) {
    return 'No configured category keywords matched; using the general triage path.';
  }

  return `Matched ${category.replace('_', ' ')} terms: ${matchedKeywords.join(', ')}.`;
}
