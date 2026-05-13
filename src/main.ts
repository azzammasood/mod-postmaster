import { Devvit } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';

import { classifyModmail } from './classifier.js';
import { formatModNote } from './noteFormatter.js';
import type {
  ClassifierConfig,
  LogEntry,
  ModmailCategory,
  ReplyTone,
} from './types.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const DEFAULT_KEYWORDS: Record<ModmailCategory, string> = {
  ban_appeal: 'ban, banned, appeal, unban, suspended, why was i banned',
  rule_question: 'rule, allowed, can i post, why removed, removal, guideline',
  harassment_report: 'harassment, threat, doxx, stalking, abuse, slur, hate',
  spam: 'promote, promotion, advertise, crypto, giveaway, affiliate, buy now',
  general: '',
};

type PostmasterCoreContext = Pick<
  Context,
  'reddit' | 'redis' | 'settings' | 'subredditId' | 'subredditName'
>;

Devvit.configure({
  redditAPI: true,
  redis: true,
});

Devvit.addSettings([
  {
    type: 'paragraph',
    name: 'subreddit-rules',
    label: 'Subreddit Rules Summary',
    helpText: 'Short summary of your top rules. Used to explain suggested replies.',
    defaultValue: '',
  },
  {
    type: 'select',
    name: 'reply-tone',
    label: 'Reply Tone',
    options: [
      { label: 'Professional', value: 'Professional' },
      { label: 'Friendly', value: 'Friendly' },
      { label: 'Strict', value: 'Strict' },
    ],
    defaultValue: ['Professional'],
  },
  {
    type: 'paragraph',
    name: 'ban-appeal-keywords',
    label: 'Ban Appeal Keywords',
    defaultValue: DEFAULT_KEYWORDS.ban_appeal,
  },
  {
    type: 'paragraph',
    name: 'rule-question-keywords',
    label: 'Rule Question Keywords',
    defaultValue: DEFAULT_KEYWORDS.rule_question,
  },
  {
    type: 'paragraph',
    name: 'harassment-report-keywords',
    label: 'Harassment Report Keywords',
    defaultValue: DEFAULT_KEYWORDS.harassment_report,
  },
  {
    type: 'paragraph',
    name: 'spam-keywords',
    label: 'Spam Keywords',
    defaultValue: DEFAULT_KEYWORDS.spam,
  },
  {
    type: 'boolean',
    name: 'enable-internal-notes',
    label: 'Enable Internal Notes',
    helpText: 'When enabled, Postmaster posts moderator-only triage notes in Modmail.',
    defaultValue: true,
  },
  {
    type: 'boolean',
    name: 'log-classifications',
    label: 'Log Classifications',
    helpText: 'Stores only metadata counts and conversation IDs, never Modmail body text.',
    defaultValue: true,
  },
]);

const sampleTriageForm = Devvit.createForm(
  {
    title: 'Postmaster Sample Triage',
    acceptLabel: 'Classify',
    fields: [
      {
        type: 'paragraph',
        name: 'messageBody',
        label: 'Sample Modmail Text',
        helpText: 'Paste sample text to preview classification without contacting the user.',
        required: true,
      },
    ],
  },
  async (event, context) => {
    const messageBody = String(event.values.messageBody ?? '');
    const config = await getClassifierConfig(context);
    const result = classifyModmail(messageBody, config);
    const note = formatModNote(result);

    try {
      await context.reddit.modMail.createModDiscussionConversation({
        subredditId: context.subredditId,
        subject: 'Postmaster sample triage',
        bodyMarkdown: note,
      });
      context.ui.showToast(
        `Postmaster sample: ${result.category.replace('_', ' ')} / ${result.priority}`,
      );
    } catch (error) {
      console.error('Postmaster sample triage notification failed', error);
      context.ui.showToast(
        `Postmaster sample: ${result.category.replace('_', ' ')} / ${result.priority}`,
      );
    }
  },
);

Devvit.addMenuItem({
  label: 'Postmaster: Test setup',
  location: 'subreddit',
  forUserType: ['moderator'],
  async onPress(_event, context) {
    const enabled = await getBooleanSetting(context, 'enable-internal-notes', true);
    await getClassifierConfig(context);
    context.ui.showToast(
      enabled
        ? 'Postmaster settings loaded. Internal notes are enabled.'
        : 'Postmaster settings loaded. Internal notes are disabled.',
    );
  },
});

Devvit.addMenuItem({
  label: 'Postmaster: Sample triage',
  location: 'subreddit',
  forUserType: ['moderator'],
  onPress(_event, context) {
    context.ui.showForm(sampleTriageForm);
  },
});

Devvit.addTrigger({
  event: 'ModMail',
  async onEvent(event, context) {
    try {
      const enabled = await getBooleanSetting(context, 'enable-internal-notes', true);
      if (!enabled) return;

      if (isModeratorOrInternalMessage(event)) return;

      const conversationId = getConversationId(event);
      if (!conversationId) {
        console.error('Postmaster: missing conversationId');
        return;
      }

      let messageBody = getMessageBody(event);
      if (!messageBody) {
        messageBody = await getMessageBodyFromConversation(event, context, conversationId);
      }

      if (!messageBody.trim()) {
        console.error('Postmaster: missing message body', {
          conversationId,
          messageId: getMessageId(event),
          authorName: getAuthorName(event),
        });
        return;
      }

      const result = classifyModmail(messageBody, await getClassifierConfig(context));
      const note = formatModNote(result);

      await context.reddit.modMail.reply({
        conversationId,
        body: note,
        isInternal: true,
        isAuthorHidden: true,
      });

      const shouldLog = await getBooleanSetting(context, 'log-classifications', true);
      if (shouldLog) {
        await logClassification(context, {
          timestamp: Date.now(),
          category: result.category,
          priority: result.priority,
          conversationId,
        });
      }
    } catch (error) {
      console.error('Postmaster failed to process Modmail', error);
    }
  },
});

export function getMessageBody(event: unknown): string {
  const eventRecord = asRecord(event);
  return firstString(
    eventRecord.body,
    eventRecord.bodyMarkdown,
    asRecord(eventRecord.message).body,
    asRecord(eventRecord.message).bodyMarkdown,
    asRecord(eventRecord.modmail).body,
    asRecord(eventRecord.modmail).bodyMarkdown,
  );
}

export function getConversationId(event: unknown): string | undefined {
  const eventRecord = asRecord(event);
  return firstString(
    eventRecord.conversationId,
    eventRecord.conversationID,
    asRecord(eventRecord.conversation).id,
    asRecord(eventRecord.conversation).conversationId,
    asRecord(eventRecord.modmail).conversationId,
  );
}

export function getAuthorName(event: unknown): string | undefined {
  const eventRecord = asRecord(event);
  return firstString(
    eventRecord.authorName,
    asRecord(eventRecord.author).name,
    asRecord(eventRecord.messageAuthor).name,
    asRecord(eventRecord.message).authorName,
    asRecord(asRecord(eventRecord.message).author).name,
  );
}

export function getSubredditName(event: unknown, context: Pick<Context, 'subredditName'>): string {
  const eventRecord = asRecord(event);
  return firstString(
    context.subredditName,
    asRecord(eventRecord.conversationSubreddit).name,
    asRecord(eventRecord.conversationSubreddit).displayName,
    asRecord(eventRecord.destinationSubreddit).name,
    asRecord(eventRecord.subreddit).name,
  );
}

async function getMessageBodyFromConversation(
  event: unknown,
  context: PostmasterCoreContext,
  conversationId: string,
): Promise<string> {
  const conversationResponse = await context.reddit.modMail.getConversation({
    conversationId,
    markRead: false,
  });
  const messages = conversationResponse.conversation?.messages ?? {};
  const messageId = getMessageId(event);

  if (messageId && messages[messageId]) {
    return messages[messageId].bodyMarkdown || messages[messageId].body || '';
  }

  const candidate = Object.values(messages)
    .filter((message) => !message.isInternal)
    .sort((a, b) => Date.parse(b.date ?? '') - Date.parse(a.date ?? ''))[0];

  return candidate?.bodyMarkdown || candidate?.body || '';
}

function getMessageId(event: unknown): string | undefined {
  const eventRecord = asRecord(event);
  return firstString(
    eventRecord.messageId,
    eventRecord.messageID,
    asRecord(eventRecord.message).id,
    asRecord(eventRecord.modmail).messageId,
  );
}

function isModeratorOrInternalMessage(event: unknown): boolean {
  const eventRecord = asRecord(event);
  const authorType = firstString(eventRecord.messageAuthorType, asRecord(eventRecord.modmail).messageAuthorType);
  const conversationType = firstString(
    eventRecord.conversationType,
    asRecord(eventRecord.modmail).conversationType,
  );

  return authorType === 'moderator' || conversationType === 'internal';
}

async function getClassifierConfig(context: Pick<Context, 'settings'>): Promise<ClassifierConfig> {
  const [
    subredditRules,
    replyTone,
    banAppealKeywords,
    ruleQuestionKeywords,
    harassmentReportKeywords,
    spamKeywords,
  ] = await Promise.all([
    context.settings.get<string>('subreddit-rules'),
    context.settings.get<string | string[]>('reply-tone'),
    context.settings.get<string>('ban-appeal-keywords'),
    context.settings.get<string>('rule-question-keywords'),
    context.settings.get<string>('harassment-report-keywords'),
    context.settings.get<string>('spam-keywords'),
  ]);

  return {
    subredditRules: subredditRules ?? '',
    replyTone: normalizeReplyTone(replyTone),
    keywordSets: {
      ban_appeal: parseKeywords(banAppealKeywords ?? DEFAULT_KEYWORDS.ban_appeal),
      rule_question: parseKeywords(ruleQuestionKeywords ?? DEFAULT_KEYWORDS.rule_question),
      harassment_report: parseKeywords(
        harassmentReportKeywords ?? DEFAULT_KEYWORDS.harassment_report,
      ),
      spam: parseKeywords(spamKeywords ?? DEFAULT_KEYWORDS.spam),
      general: [],
    },
  };
}

async function getBooleanSetting(
  context: Pick<Context, 'settings'>,
  name: string,
  fallback: boolean,
): Promise<boolean> {
  return (await context.settings.get<boolean>(name)) ?? fallback;
}

function normalizeReplyTone(value: string | string[] | undefined): ReplyTone {
  const selected = Array.isArray(value) ? value[0] : value;
  if (selected === 'Friendly' || selected === 'Strict') return selected;
  return 'Professional';
}

function parseKeywords(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);
}

async function logClassification(context: PostmasterCoreContext, entry: LogEntry): Promise<void> {
  const subredditId = context.subredditId || getSubredditName({}, context) || 'unknown';
  const key = `postmaster:logs:${subredditId}`;
  await context.redis.zAdd(key, {
    member: JSON.stringify(entry),
    score: entry.timestamp,
  });
  await context.redis.zRemRangeByScore(key, 0, Date.now() - THIRTY_DAYS_MS);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

export default Devvit;
