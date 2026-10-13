# Contact form implementation plan

Replace the portfolio's email link with `/contact`. Accept the visitor's name,
email, and message through the existing Spring Boot API. Store the message in
Postgres before acknowledging it, then notify `gabrielpazruiz02@gmail.com`
through the Gmail API over HTTPS. Optionally notify the owner through a Telegram
bot, with an independent delivery for each channel.

Status: implemented locally. Production activation requires the external inputs
listed at the end. Telegram is implemented and disabled by default.

## Existing integration points

- `src/frontend/src/pages/index.astro` opens `/contact` from its contact action.
- `src/frontend/src/services/api.ts` owns browser API requests and `ApiError`.
- `src/frontend/src/types/index.ts` aliases generated OpenAPI types.
- `src/frontend/src/lib/api/README.md` describes contract generation.
- `docs/frontend/architecture.md` requires Astro pages, React islands for state,
  and updates to its file index when frontend files change.
- `src/backend/src/main/java/com/cosmiclatte/dev/portfolio/` already contains
  controller, DTO, service, model, and repository layers.
- `ResponseFormat<T>` defines the response envelope. `ApiPaths` owns route names.
- Flyway owns schema changes. Use the next available migration version when
  implementation begins, rather than reserving a number in this plan.
- The frontend runs on Vercel, the API on Render, and Postgres on Supabase.
  The frontend architecture records API cold starts of 30–60 seconds.

## Delivery design

```text
Visitor -> home contact link -> /contact -> POST /api/contact/messages
  -> validate and enforce limits
  -> commit message, EMAIL delivery, and optional TELEGRAM delivery in one transaction
  -> dispatch a background send after commit and return 202 Accepted

Delivery runner -> claim due deliveries in Postgres
  -> refresh the owner's OAuth token and call Gmail outside the database transaction
  -> record provider acceptance or schedule a retry
  -> send enabled TELEGRAM jobs through the Bot API with independent receipts and retries
```

Use the existing backend instead of adding a second backend in Vercel.
Use Spring's existing HTTP client facilities instead of requiring a vendor SDK.
Use Postgres as the durable delivery queue instead of adding a message broker.
An in-memory event or an untracked asynchronous task cannot replace persistence.

Render free services block SMTP ports 25, 465, and 587. HTTPS delivery avoids that
restriction. See [Render free service limits](https://render.com/docs/free).

The owner does not have a verified sending domain. Gmail API replaces the
domain-based provider. The owner authorizes a Google Desktop OAuth client once
through a local loopback callback. Visitors only fill out the form and never
authorize Google. No public callback URL, custom domain, Gmail password, or
SMTP connection is required.

Set the authorized Gmail address as `From` and the owner's Gmail destination as
`To`. Set the visitor's validated ASCII email address as `Reply-To`. Encode a
plain-text UTF-8 MIME message in the Gmail API's base64url `raw` field. Store
that immutable request before dispatch. Use a fixed subject and stable
`Message-ID` containing the message reference. The stable header aids manual
review but does not provide provider-side idempotency.
See [Gmail message sending](https://developers.google.com/workspace/gmail/api/guides/sending).

## Authorize the owner account

1. Create or select a Google Cloud project and enable Gmail API.
2. Configure the OAuth consent screen. For local testing, add the owner as a
   test user. Request only `https://www.googleapis.com/auth/gmail.send`.
3. Create an OAuth client with application type **Desktop app**. Download its
   JSON file outside the repository. A Desktop client supports a local callback
   and does not need the portfolio's public URL.
4. Run the helper from the repository root, replacing the client path:

   ```powershell
   python src/backend/gmail-auth.py --client C:/private/google-desktop-client.json
   ```

5. Authorize `gabrielpazruiz02@gmail.com` in the browser. The helper checks state,
   uses PKCE, and atomically saves the refresh token to the ignored `.env.local`.
   It preserves existing settings and does not print credential values.
6. Configure database access in `.env`, then start the backend with
   `powershell -ExecutionPolicy Bypass -File src/backend/run.ps1`. That launcher
   loads `.env` first and `.env.local` second. Direct Maven launches need the
   same values in process environment variables.
7. Configure the same private settings in Render. Configure a recovery scheduler
   before opening production intake. Send a real inquiry through the deployed
   form and inspect the mailbox and Reply-To behavior.

For a different authorized owner, add `--email owner@gmail.com`. Only the owner
runs this helper. Authorization never appears in the visitor's form.
See [Google Desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app)
and [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes).

Google issues seven-day refresh tokens for an external app whose consent status
is Testing when Gmail scopes are requested. Resolve the project's production
consent requirements before relying on unattended delivery. Revocation and
password changes can also invalidate tokens. Re-run owner authorization when
Google returns `invalid_grant`. See [Google token expiration](https://developers.google.com/identity/protocols/oauth2#expiration).

Only the owner grants Google access in this design. Google's personal-use
exception may apply to that authorization even though the portfolio form is
public. Form visitors are not Google OAuth users. Review the project's status
against [Google's verification exceptions](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification#exceptions-to-verification-requirements).

## Public API contract

`POST /api/contact/messages` accepts `CreateContactMessageRequest`:

| Field | Validation |
| --- | --- |
| `submissionId` | Required UUID generated by the browser |
| `name` | Required, trimmed, 1–100 characters |
| `email` | Required, trimmed, valid email syntax, at most 254 characters |
| `message` | Required, trimmed, 10–5,000 characters |
| `website` | Optional honeypot, empty for legitimate submissions |

Reject malformed requests before storing anything. Email syntax validation
does not prove that the visitor owns the address. Preserve message line breaks
and email local-part casing. Never render visitor content as trusted HTML.

Return `ResponseFormat<ContactAcceptedResponse>` with HTTP 202:

```json
{
  "success": true,
  "message": null,
  "data": {
    "messageId": "server-generated-uuid",
    "status": "accepted"
  },
  "meta": null,
  "errors": null
}
```

Repeat requests with the same submission ID and normalized content return the
same receipt without creating deliveries or consuming submission quota again.
Use a database unique constraint and a normalized content fingerprint. Reusing
the ID with different content returns 409. Handle concurrent duplicate inserts
without leaving the service in a failed transaction.

Use the existing error envelope for validation failures, conflicts, rate limits,
and temporary unavailability. Return 400 for invalid input, 413 for oversized
bodies, 429 with `Retry-After` for limits, and 503 when contact intake is disabled
or cannot commit. Never report acceptance when persistence fails.

No public message listing or status lookup is needed for this release. Knowing
a submission ID must not expose the visitor's email or message.

## Persistence and delivery lifecycle

Create `contact_messages` with a server UUID, unique submission UUID, normalized
content fingerprint, name, email, message, and creation timestamp.

Create `contact_deliveries` with message ID, channel, state, attempt count,
first-attempt timestamp, next-attempt timestamp, lease token, lease expiration,
provider ID, safe failure code, and update timestamp. Enforce uniqueness on
message ID and channel. Store a stable email payload or immutable sender,
recipient, and template version so retries cannot change the provider request.

Delivery states:

| State | Meaning |
| --- | --- |
| `PENDING` | Ready now or waiting for its next retry |
| `PROCESSING` | Claimed by one runner with a bounded lease |
| `PROVIDER_ACCEPTED` | Provider accepted the message; inbox placement is unknown |
| `FAILED` | Definitive failure or exhausted retry budget |
| `REQUIRES_REVIEW` | Outcome is uncertain and safe automatic retry is no longer possible |

Claim due rows in a short transaction using row locking and `SKIP LOCKED`.
Release the transaction before network calls. Complete a delivery only if its
lease token still matches. Renew ownership after token refresh and before send.
Expired processing leases require review rather than an automatic resend. Keep HTTP
timeouts shorter than the lease, and bound each runner invocation.

Gmail API does not expose a request idempotency key. Any network failure during
send, invalid success receipt, send-side 5xx response, or interrupted worker
requires review immediately. Do not repeat a possibly accepted message.
The submission UUID still prevents duplicate intake within the database.

Defaults are five total attempts, with retry delays of 1, 5, 30, and
120 minutes, with a 23-hour retry age budget. Token acquisition failures are
safe to retry because no email request was made. Explicit Gmail 401, 429, and
recognized rate-limit 403 rejections are also safe to retry. Respect Retry-After.
Treat invalid credentials, invalid
sender configuration, and rejected payloads as operational failures requiring
correction. Do not retry those continuously.

Provider acceptance is the initial terminal success state. Delivery webhooks,
if added later, must authenticate events and distinguish delivery from inbox
placement. Do not claim exactly-once delivery beyond the provider's guarantee.

## Run deliveries while Render is idle

Preferred deployment: a Supabase Cron HTTP job invokes
`POST /api/internal/contact/deliveries/process` every five minutes. Supabase Cron
supports HTTP jobs. See [Supabase Cron](https://supabase.com/docs/guides/cron).

Protect the internal route with a dedicated bearer token, separate from the
admin key. Store scheduler credentials in a secret store, never in committed SQL
or request URLs. Do not expose the runner through browser CORS configuration.

Start with a batch of five messages and a bounded request runtime. Verify that
the scheduler HTTP timeout covers the Render cold start and batch processing.
Failed invocations leave due rows available for the next invocation. Concurrent
invocations remain safe because delivery claims use leases.

If the current Supabase project cannot support this job, or the cold start
exceeds its usable HTTP timeout, use an approved always-on Render instance with
a scheduled runner. This fallback changes hosting cost and is a deployment
decision, not an automatic purchase. Verify scheduling before opening intake.

Set `CONTACT_SCHEDULED_ENABLED=true` only on an always-on instance to run the
same processor every minute. Keep the flag false when using Supabase Cron.
`CONTACT_PROCESSING_ENABLED=false` pauses sends independently of new intake.
Authenticated runs still clean up old successful messages while sends are paused.

### Configure the Supabase job

Enable Supabase Cron, `pg_net`, and Vault through the project dashboard.
Create two Vault secrets named `contact_runner_url` and `contact_runner_token`.
The URL must be the complete HTTPS runner endpoint. The token must match the
backend's `CONTACT_RUNNER_TOKEN`. Enter secret values in Vault rather than
committing them or placing them in the scheduled SQL.

Run this SQL in the project's SQL editor. Scheduling the same job name updates
that job. The HTTP timeout is two minutes to allow for Render startup.
See [Supabase Cron quickstart](https://supabase.com/docs/guides/cron/quickstart).

```sql
SELECT cron.schedule(
    'contact-delivery-runner',
    '*/5 * * * *',
    $job$
    SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets
                WHERE name = 'contact_runner_url'),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' ||
                (SELECT decrypted_secret FROM vault.decrypted_secrets
                 WHERE name = 'contact_runner_token')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
    );
    $job$
);
```

Check both Cron history and `net._http_response`. A successful SQL job only
means the HTTP request was queued, not that the backend returned 200. Inspect
the HTTP status, timeout flag, and error message. Verify one real scheduled run
after Render has been idle before activating the form.

## Form behavior and abuse controls

Prerender `src/frontend/src/pages/contact.astro` and mount one `ContactForm.tsx`
island with `client:load`. Extend `api` with `submitContactMessage` and use
generated request and response types. Keep API calls in `services/api.ts`.

Render Name, Email, Message, and Send message controls with the existing visual
tokens. Include a short data-use notice. Keep the honeypot out of keyboard
navigation and assistive technology. Include an explanatory fallback when
JavaScript is disabled.

Form states are editing, submitting, accepted, and recoverable error. Preserve
input after errors, announce results accessibly, and focus the first invalid
field. Disable repeated submission while a request is pending. Show a slow-start
message after ten seconds and allow a bounded wait of about ninety seconds.
Do not show invented percentage progress.

Retain the submission UUID when retrying the same payload. If the visitor edits
the payload after a failed attempt, generate a new UUID and explain uncertain
outcomes where appropriate. Keep the draft in component memory for this release,
without writing personal content to local storage. Clear input only after 202.

Replace all applicable `mailto:` entry points with `/contact`. Keep the visible
Gmail address if useful. Use English product copy, code, comments, and docs.

Enforce intake limits of three new messages per trusted client IP in a fixed
fifteen-minute window and fifty new messages globally per UTC day. Make limits
configurable and match the global ceiling to the selected provider quota.
Use database-backed atomic counters so restarts and replicas do not reset limits.
Expire counter rows after their windows close. A honeypot supplements limits;
it does not replace them. Add a server-verified challenge if observed abuse
requires one.

Review Render's proxy behavior before trusting forwarded IP headers.
`ClientIp.resolve` currently takes the first forwarded value, which is not
sufficient evidence that the value is trustworthy for abuse enforcement.
Use an HMAC with a private key for stored IP identifiers. Restrict allowed
origins, but do not treat CORS as authentication or bot protection.

Reject request bodies above 32 KiB at the contact boundary. Keep names and email
addresses out of custom mail headers. Never log message bodies, visitor email
addresses, IP addresses, API keys, or authorization headers.

## Telegram activation

`ContactRepository.Channel` defines EMAIL and TELEGRAM. The delivery processor
claims jobs for enabled channels only. Telegram is disabled by default. Both senders
reuse the existing HTTP client, leases, bounded retries, and recovery runner.

1. Create a bot through BotFather and save `TELEGRAM_BOT_TOKEN` in `.env.local`.
2. Open the bot's private chat and send `/start`. Read the chat ID from the Bot
   API's `getUpdates` response and save it as `TELEGRAM_CHAT_ID`.
3. Set `CONTACT_TELEGRAM_ENABLED=true`. Keep `CONTACT_PROCESSING_ENABLED=true`
   and configure the recovery runner, then restart the backend.
4. Submit one new contact message. Inspect EMAIL and TELEGRAM rows by message ID,
   and confirm the notification in the owner's private chat.

The bot sends contact notifications and does not implement command replies.
It does not need a webhook or continuous incoming-update polling.

Create delivery rows only for enabled, implemented channels at intake time.
Existing messages will not automatically receive Telegram notifications when
the channel is added. Any historical replay must be an explicit operation.

Telegram payloads store the destination and plain text at intake time. No HTML or
Markdown parse mode is used, and link previews are disabled. Notifications longer
than 4096 UTF-16 code units are truncated with a notice; email retains the full
message. Explicit HTTP 429 rejection uses `parameters.retry_after` and the bounded
local backoff. Other 4xx responses fail visibly. Network failures, 5xx responses,
invalid receipts, and interrupted leases require manual review without automatic
resend because `sendMessage` has no idempotency key. Telegram failure never resets
an accepted EMAIL delivery. See the [Telegram Bot API](https://core.telegram.org/bots/api#sendmessage).

## Configuration and retention

Add placeholders to the root `.env.example` and map them through
`src/backend/src/main/resources/application.yml` during implementation:

| Setting | Purpose |
| --- | --- |
| `CONTACT_EMAIL_ENABLED` | Intake and email activation, false by default |
| `GMAIL_CLIENT_ID` | Google Desktop OAuth client identifier |
| `GMAIL_CLIENT_SECRET` | Private Desktop OAuth client credential |
| `GMAIL_REFRESH_TOKEN` | Private send-only authorization granted by the owner |
| `CONTACT_FROM_EMAIL` | Gmail address authorized by the owner |
| `CONTACT_TO_EMAIL` | Owner's Gmail destination |
| `CONTACT_RUNNER_TOKEN` | Private scheduler credential |
| `CONTACT_IP_HASH_KEY` | Private HMAC key for abuse counters |
| `CONTACT_PROCESSING_ENABLED` | Pause sends without losing queued messages |
| `CONTACT_IMMEDIATE_ENABLED` | Dispatch after commit, true by default |
| `CONTACT_SCHEDULED_ENABLED` | Enable the one-minute runner on always-on hosting |
| `CONTACT_TRUST_FORWARDED_FOR` | Trust ingress headers only after verifying the proxy |
| `CONTACT_IP_LIMIT` | New messages per fixed fifteen-minute IP window |
| `CONTACT_DAILY_LIMIT` | New messages per UTC day across all clients |
| `CONTACT_PROVIDER_URL` | Provider endpoint, overridable for local tests |
| `GMAIL_TOKEN_URL` | Token refresh endpoint, overridable for local tests |
| `CONTACT_TELEGRAM_ENABLED` | Optional Telegram deliveries for new messages, false by default |
| `TELEGRAM_BOT_TOKEN` | Private BotFather credential, backend only |
| `TELEGRAM_CHAT_ID` | Numeric owner chat destination |
| `TELEGRAM_API_URL` | Bot API base URL, overridable for local tests |

Require nonempty production settings when contact is enabled. Keep all secrets
out of frontend bundles. Reuse `PUBLIC_API_URL` for browser transport.

Retention is thirty days for messages whose deliveries were all accepted by
their providers. Delete those delivery records with their messages. Keep the
submission receipt throughout that period. Unresolved failures remain for review
and are not deleted automatically. Backups, provider logs, and the owner's Gmail
have their own retention policies. Row-level security is enabled without public
policies on all contact tables. Only the trusted backend database role accesses
their contents.

## Implementation phases and acceptance gates

1. **Confirm deployment inputs.** Verify Gmail API access, owner authorization,
   quota, recipient, and the scheduler path. Local
   implementation can proceed with a mocked provider while these are pending.
2. **Implement intake and persistence.** Add DTOs, controller, validation,
   atomic limits, repositories, and the Flyway migration. Prove that rollback,
   duplicate requests, and concurrent inserts cannot create orphan deliveries.
3. **Implement email processing.** Add the sender, lease-based runner, retry
   policy, authenticated internal endpoint, and disabled Telegram setting.
   Verify crashes and repeated invocations against a mocked provider.
4. **Generate the contract and implement the form.** Refresh
   `src/frontend/openapi.json` from the running API, then run `bun run gen:api`.
   Add the page and island, extend the API client, and replace email links.
   Update `docs/frontend/architecture.md` with the route, island, file index,
   and contact-specific behavior in the same change.
5. **Verify the complete flow.** Run backend verification with Postgres,
   `bun run check`, and `bun run build`. Test the real browser in mobile and
   desktop layouts, with keyboard navigation and simulated slow responses.
6. **Deploy and activate.** Deploy the backend before the frontend. Configure
   Gmail OAuth credentials and the scheduler. Verify the internal endpoint rejects
   unauthorized requests before enabling intake. Send an authorized test through
   the deployed form, inspect Gmail, and verify Reply-To by replying.

Keep changes atomic with English Conventional Commit subjects. New frontend
files require architecture updates. Telegram activation follows the setup above.

## Verification matrix

| Scenario | Required result |
| --- | --- |
| Valid submission | One persisted message, one EMAIL delivery, one receipt |
| Invalid input or filled honeypot | No stored message or notification |
| Same submission repeated concurrently | One message and the same receipt |
| Same submission ID with different content | 409 without another delivery |
| Database commit fails | No acceptance response |
| Intake limit reached | 429 and no new delivery |
| Token refresh fails temporarily | Retained delivery with a bounded retry before send |
| Gmail send times out or returns 5xx | Review required, no automatic resend |
| Crash after provider acceptance | Review required, no automatic resend |
| Two runners overlap | One valid claim per delivery |
| Expired lease | Review required without stale completion overwrites |
| Uncertain outcome | Review required, no automatic resend |
| Telegram disabled | No Telegram rows or network calls |
| Telegram enabled | Atomic EMAIL and TELEGRAM rows, independent accepted receipts |
| Telegram retry or failure | EMAIL success unchanged, bounded 429 retries, uncertain outcomes require review |
| Invalid runner token | Rejected before queue access |
| Browser network error or cold start | Draft retained and retry remains possible |
| Production email | Received in Gmail with the correct Reply-To |
| Retention cleanup | Content removed according to policy without losing active work |

## Operations and rollback

Use this query to inspect backlog and failures without exposing message bodies:

```sql
SELECT channel, state, count(*) AS deliveries, min(updated_at) AS oldest_update
FROM contact_deliveries
GROUP BY channel, state
ORDER BY channel, state;
```

Inspect `failure_code` and `provider_id` for a specific message reference.
Correct configuration errors before retrying failed deliveries. Confirm the
Gmail outcome before manually resetting any uncertain delivery.
Do not reset `PROVIDER_ACCEPTED` rows. For a confirmed unsent message,
an operator may set its state to `PENDING`, clear its lease and failure code,
and reset attempts and first-attempt time. Retain the immutable payload and
message ID. Never apply that operation to an uncertain outcome without review.

Record message reference, channel, attempt count, safe failure code, provider ID,
and elapsed processing time. Monitor failed deliveries, review-required rows,
oldest pending age, provider quota, and scheduler run failures. Define an owner
and an operational review procedure before activation. Failed delivery must not
become invisible simply because the visitor already received a receipt.

New intake is disabled by default and returns 503 until Gmail is configured.
The form retains the visitor's draft when intake is unavailable.
Pause delivery processing separately if a provider incident requires it. Preserve
queued messages and keep the additive schema during rollback. Resume with the
same delivery IDs, payloads, and safe retry rules. Do not roll back by dropping
message tables or resetting successful deliveries.

## Local verification

Run the backend against a local Postgres instance using the `DB_*` settings
from `.env.example`. Contact tests create and remove their own unique schema,
so resetting fixtures cannot delete existing messages. They start a local HTTP
provider simulator and do not send email through Google. Contact intake remains
disabled by default outside tests.

```powershell
# From src/backend, with isolated local database settings in the environment.
./mvnw.cmd -B verify

# From the repository root, without network access or credentials.
python src/backend/gmail-auth.py --check

# From src/frontend, after refreshing openapi.json from /v3/api-docs.
bun run gen:api
bun run check
bun run build
```

`ContactFlowTest` verifies the HTTP intake, Postgres transactions, concurrency,
limits, provider payload and retries, lease recovery, retention, row security,
and disabled configurations. The frontend was also exercised in desktop and
mobile browsers against a local API and provider simulator. Browser checks
covered retained drafts, stable retry IDs, invalid receipts, field focus, and
the JavaScript fallback. Owner OAuth credentials are required for the
separate production Gmail check. Telegram tests exercise atomic channel creation,
independent retries, permanent failures, uncertain outcomes, disabled channels,
plain-text length limits, and retention. Local verification passed 30 backend
tests. A real submission through a temporary backend using an isolated local
database received EMAIL and TELEGRAM provider acceptance on the first attempt.
The owner's normal backend must restart to load Telegram settings and new code.

## Production prerequisites still to resolve

- A Google Cloud project with Gmail API and a Desktop OAuth client.
- The owner's send-only OAuth grant and production consent configuration.
- Scheduler support, secrets storage, and verified cold-start timeout behavior.
- The operational owner and approved retention policy.

These inputs gate production activation. They do not prevent local implementation
or validation with a mocked sender and local Postgres.
