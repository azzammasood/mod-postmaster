# Postmaster

**Free Modmail triage and reply templates for Reddit mod teams.**

Postmaster is a Devvit-native moderation assistant that helps moderators handle Modmail faster without sending message content to external services. It watches new Modmail events, classifies incoming messages with configurable keyword rules, and posts an internal moderator-only note in the same conversation.

Postmaster is human-in-the-loop by design. It is not an auto-reply bot, does not send user-visible replies, and never takes final moderation action for the team.

## What It Does

When new Modmail arrives, Postmaster:

- Reads the incoming message body from the Modmail conversation.
- Classifies the message as `ban_appeal`, `rule_question`, `harassment_report`, `spam`, or `general`.
- Assigns priority as `urgent`, `normal`, or `low`.
- Posts an internal note containing the category, priority, reason, suggested reply template, and moderator checklist.
- Logs only metadata for future digest/statistics work.

## Why Mods Need It

Busy mod teams often spend the first few minutes of every Modmail thread deciding what kind of message it is, how urgent it feels, and what a good first response should cover. Postmaster turns that repeat work into a consistent internal brief so moderators can focus on judgment, context, and the final response.

## How Classification Works

Postmaster uses deterministic local rules:

- Keyword and phrase matching against configurable category lists.
- Whitespace and casing normalization before matching.
- Tie-break order: harassment reports, ban appeals, rule questions, spam, then general.
- Priority rules that elevate safety reports and urgent appeal language.

There is no LLM, no hosted backend, no external AI dependency, and no paid API.

## Categories And Priorities

Categories:

- `ban_appeal`
- `rule_question`
- `harassment_report`
- `spam`
- `general`

Priorities:

- `urgent`: safety-sensitive reports or appeals with urgent review language.
- `normal`: most ban appeals, rule questions, and longer general support issues.
- `low`: spam/promotion and short general messages.

## Configuration

Installers can configure:

- Subreddit rules summary.
- Reply tone: Professional, Friendly, or Strict.
- Ban appeal keywords.
- Rule question keywords.
- Harassment report keywords.
- Spam keywords.
- Whether internal notes are enabled.
- Whether classification metadata logging is enabled.

## Privacy And Reliability

Postmaster is built for privacy-first moderation workflows:

- Free and Devvit-native.
- No OpenAI, Anthropic, Claude, or external AI API.
- No paid service.
- No hosted backend.
- No Modmail body text stored in Redis.
- No user-visible messages sent by the app.
- Internal moderator notes only.

The Redis log stores only timestamp, category, priority, and conversation ID, then trims entries older than 30 days.

## Demo Flow

1. Install Postmaster in a test subreddit.
2. Configure keyword lists and reply tone in the app settings.
3. Send a sample Modmail message to the subreddit.
4. Open the Modmail conversation as a moderator.
5. Confirm Postmaster posted an internal note with triage, suggested reply, and checklist.
6. Use the subreddit menu action **Postmaster: Sample triage** to test classifications without waiting for live Modmail.

## Technical Overview

- Runtime: Reddit Devvit.
- Language: TypeScript.
- APIs: Reddit API, Modmail, Settings, Redis.
- Entry point: `src/main.ts`.
- Classifier: `src/classifier.ts`.
- Internal note formatter: `src/noteFormatter.ts`.
- Types: `src/types.ts`.

Postmaster is separate from Flashpoint Handoff. Flashpoint watches volatile public threads; Postmaster triages private Modmail conversations.

## Development

```powershell
npm.cmd install
npm.cmd run build
npx.cmd devvit upload
```

Use `npx.cmd devvit playtest <subreddit>` after upload once a test subreddit is selected.

## Source

GitHub: https://github.com/azzammasood/mod-postmaster
