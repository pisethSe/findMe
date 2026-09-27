# Administrator support bot (Telegram)

The backend ships a small inbound Telegram bot for platform administrators. It
answers a fixed, read-only command set from an allow-listed Telegram account and
never changes marketplace state: listing approval, rejection, suspension and
publication stay in the authenticated admin console, where every decision is
audited.

- Module: `backend-part/src/modules/telegram`
- Endpoint: `POST /api/v1/telegram/webhook` (signed, invisible while disabled)
- Configuration: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SUPPORT_ADMIN_IDS`,
  `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_SUPPORT_POLLING`

## Commands

| Command         | Answer                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| `/status`       | Database reachability plus pending moderation, open reports, published rentals, and active landlord counts |
| `/pending 1-10` | Oldest rentals waiting for moderation: bounded title, landlord name, waiting hours, listing id |
| `/reports 1-10` | Oldest open reports: reason, age, report id, rental id                 |
| `/stats 1-31`   | Anonymous analytics totals for the last days (UTC), non-zero events only |
| `/help`, `/start` | Command list                                                         |

An unknown command answers with the same command list. An optional argument is
bounded (`1-10` for lists, `1-31` for statistics); a malformed or out-of-range
value answers with explicit usage instead of guessing. Titles and names are
collapsed to a single line and truncated, so an untrusted rental title cannot
forge extra reply lines or a fake command.

## Authorization

- The bot only exists while `TELEGRAM_SUPPORT_ADMIN_IDS` lists at least one
  numeric Telegram user id. An empty list keeps both transports and the route
  switched off.
- Every update is answered only when its sender id is on that list. Another
  account receives a private-bot notice that echoes its own Telegram user id (so
  an operator can add it) and no marketplace data.
- Messages sent by other bots are ignored, and an update id is answered at most
  once per process, because Telegram retries a webhook delivery when a response
  was lost.
- Authorization is by Telegram account, not by the API session: the bot runs
  with its own read-only queries, connection to the marketplace requires the
  existing `ADMIN` role and JWT, and no command can approve, reject, suspend,
  publish, or delete anything.

## Transports

Telegram serves either a webhook or `getUpdates` for one bot, never both. The
backend therefore supports exactly one transport per environment.

### Signed webhook (staging and production)

`TELEGRAM_WEBHOOK_SECRET` is required in staging and production. Telegram sends
it back in the `X-Telegram-Bot-Api-Secret-Token` header of every call, and the
guard compares it in constant time before the body is read. A missing or wrong
header is rejected with `401 TELEGRAM_WEBHOOK_UNAUTHORIZED`; an unset secret
hides the route with `404 NOT_FOUND`.

Register the endpoint once per deployment (the secret must match the deployed
value):

```bash
curl -sS "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://api.example.com/api/v1/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
  -d 'allowed_updates=["message"]'
```

### Long polling (local development)

Local development can answer without a public HTTPS endpoint:

```bash
TELEGRAM_BOT_TOKEN=... \
TELEGRAM_SUPPORT_ADMIN_IDS=1013974119 \
TELEGRAM_SUPPORT_POLLING=true \
corepack pnpm run dev:backend
```

`TELEGRAM_SUPPORT_POLLING` must be `true` or `false` and is rejected in staging
and production, so a deployment can never silently steal updates from the
webhook cursor. The polling loop is detached from request handling, backs off
five seconds when Telegram is unreachable, confirms each update through the
offset, and stops on shutdown.

## Privacy and security

- Replies contain aggregates and moderation identifiers only: no student
  message, reporter identity, email address, phone number, or credential is
  selected for a chat reply.
- Answers are plain text with page previews disabled, capped at 3,500
  characters, and never include exception text: an unexpected read failure
  answers with a bounded retry message.
- The bot token and webhook secret are secrets: they are validated at startup and
  never logged, echoed, or included in an error payload. `TELEGRAM_BOT_TOKEN is
  malformed or still a placeholder.` fails startup instead of shipping a broken
  bot.
- A half-configured setup fails fast: admin ids without a token, a webhook
  secret without admin ids, or polling in a deployed environment all reject
  startup.
- Telegram is optional. With no configuration the API behaves exactly as before,
  and the inquiry alert described in [Inquiries](INQUIRIES.md) stays independent
  of the support bot.

## Verification

```bash
corepack pnpm --filter @findme/backend run test
```

The suite covers the disabled no-op, admin-only authorization, command parsing
and bounded arguments, single-line label sanitization, empty and populated
queues, the statistics window, bounded failures, duplicate update ids, bot
senders, and the signed webhook (hidden route, wrong secret, accepted update).

## Troubleshooting

- `Bad Request: chat not found` in the API log (`TELEGRAM_SEND_FAILED`) means the
  bot has no conversation with that chat yet. Telegram never lets a bot start a
  conversation: the administrator must open the bot once and press **Start**
  (`https://t.me/<bot_username>`). The same one-time step is required before
  inquiry alerts can reach the configured chat.
- Nothing is sent and no route exists: `TELEGRAM_SUPPORT_ADMIN_IDS` is empty.
  Listing an administrator id is what switches the bot on.
- `404` on the webhook with admin ids configured: `TELEGRAM_WEBHOOK_SECRET` is
  unset, which is correct for the local polling transport.
- No reply arrives while polling is enabled: `getUpdates` returns only updates
  that Telegram has not confirmed for the bot. A registered webhook and long
  polling cannot run at once; check `getWebhookInfo` and remove the webhook with
  `setWebhook?url=` before polling locally.
- Startup fails with `TELEGRAM_WEBHOOK_SECRET is required in staging and
  production` or `TELEGRAM_SUPPORT_POLLING must be false in staging and
  production`: deployed environments must use the signed webhook transport.
