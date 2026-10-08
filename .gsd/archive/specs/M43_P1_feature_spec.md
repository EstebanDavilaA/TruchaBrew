# FEATURE SPECIFICATION: M43_P1 — Tell me what went wrong while your hands were wet
> **AMENDMENT 1 (2026-09-07 — Steering Option A Refinement):**
> Amendment 1 proposed a Slack webhook default in `.env.production`. The credential is redacted and excluded from version control; deployments must provide `TRUCHABREW_FEEDBACK_WEBHOOK_URL` through a private environment file or process environment.

## Phase Summary
Milestone 43 is the closing milestone of the **"Ready to Hand to a Brewer"** initiative (Milestones 40–43). It provides a lightweight, reachable in-app feedback box that allows a brewer to report confusion or defects mid-brew with wet hands, sending essential technical context to the author without leaving the app or requiring extra accounts.

### Key Behaviors
1. **Reachable Entry Point for Wet Hands**: A persistent, touch-friendly floating action button (`FeedbackButton`) positioned at `bottom-4 right-4` with high z-index (`z-40`), measuring at least 44x44px (WCAG 2.5.5 touch target standard), visible and operable from all screens including brew-day tracker and batch detail views.
2. **One-Thumb Compose & Send**: Tapping the button opens `FeedbackModal`, presenting an auto-focused textarea (`min-h-[120px]`, 44px minimum controls) and a single "Send Feedback" primary button.
3. **Non-Destructive Failure**: If sending fails (e.g. offline, server error, or webhook delivery failure), the error message is displayed clearly and **the brewer's typed text is strictly preserved in the textarea**. A brewer with wet hands is never forced to retype their report.
4. **Automatic Context Attachment (Privacy-Honest)**: The app attaches technical diagnostic metadata (`appVersion`, current `route`/view, `viewport` `{ width, height }`, and if an active batch is open: `batchId`, `batchName`, `batchStage`). It **strictly excludes** private recipes, ingredient lists, notes, local file paths, or tester-identifying information (no IP forwarding, no cookies, no accounts). The modal explicitly discloses what context is attached.
5. **Shipped Webhook Destination with Environment Override**: The backend server exposes `POST /api/feedback`. By default, the repo ships a committed `.env.production` specifying the author's Slack webhook URL, loaded at startup so feedback works out-of-the-box for any tester. A tester can override it via `TRUCHABREW_FEEDBACK_WEBHOOK_URL` in their own local `.env` or process environment. If explicitly unconfigured (both env var and default missing/empty), the server returns 503 `FEEDBACK_NOT_CONFIGURED`. If delivery fails or times out (10s), it returns 502 `FEEDBACK_DELIVERY_FAILED`.
6. **Webhook Compatibility**: Outbound payload provides both a top-level formatted markdown string (`content` and `text`) and structured JSON (`feedback`), ensuring immediate compatibility with Discord webhooks, Slack incoming webhooks, Google Forms / Apps Script, and generic HTTP endpoints without intermediate translation layers.

---

### Resolved Ambiguities (Binding)
- **RA-1 — Feedback Destination Protocol**: HTTP POST with a JSON webhook configured through `TRUCHABREW_FEEDBACK_WEBHOOK_URL`. The credential is intentionally excluded from version control and must be supplied through a private environment file or process environment.
- **RA-2 — Single-Phase Milestone Closure**: Milestone 43 is scoped as a single, self-contained phase (`M43_P1`). The backend route, shared types, and frontend UI are tightly coupled and can be verified end-to-end within 15 authorized files. No Phase 2 is planned.
- **RA-3 — Empty / Whitespace / Boundary Validation**:
  - `message`: Required, trimmed length between 1 and 5000 characters inclusive (`1 <= message.trim().length <= 5000`).
  - Whitespace-only submissions or empty strings return 400 `VALIDATION_FAILED` ("Message cannot be empty").
  - Messages exceeding 5000 characters return 400 `VALIDATION_FAILED`.
- **RA-4 — Status Codes & Error Semantics**:
  - `200 OK`: Outbound webhook returned 2xx status code. Response body: `{ success: true, timestamp: string }`.
  - `400 Bad Request`: Validation failure on input schema (e.g. missing/empty message).
  - `502 Bad Gateway`: Server attempted outbound webhook delivery, but destination returned non-2xx status, network error, or timed out (10 seconds timeout via `AbortSignal.timeout(10000)`). Error code: `FEEDBACK_DELIVERY_FAILED`.
  - `503 Service Unavailable`: Server has no `TRUCHABREW_FEEDBACK_WEBHOOK_URL` configured and no `.env.production` destination. Error code: `FEEDBACK_NOT_CONFIGURED`.
- **RA-5 — Dual Payload Format for Broad Webhook Support**:
  The outbound POST to `TRUCHABREW_FEEDBACK_WEBHOOK_URL` sends:
  ```json
  {
    "content": "📢 **TruchaBrew Feedback**\n> <message>\n\n**Context:** App `<appVersion>` • Route `<route>` • Viewport `<width>x<height>` • Batch: `<batchName>` (`<batchStage>`)",
    "text": "TruchaBrew Feedback: <message>",
    "feedback": {
      "message": "<message>",
      "timestamp": "<iso_timestamp>",
      "context": {
        "appVersion": "<appVersion>",
        "route": "<route>",
        "viewport": { "width": 390, "height": 844 },
        "batchId": "<id>",
        "batchName": "<name>",
        "batchStage": "<stage>"
      }
    }
  }
  ```
  This schema ensures instant rendering in Discord (`content`), Slack (`text`), and custom webhook consumers (`feedback`).
- **RA-6 — Privacy & Telemetry Guardrail**:
  The client and server must **never** transmit:
  - User IP address
  - Recipe grain bill, hop schedule, water profile, or yeast data
  - Brewer name, tasting notes, or database file paths
  - Local device hostnames or MAC addresses
  The modal includes an explicit privacy disclosure: *"Only your message and the technical screen context shown below will be sent. Your recipes, inventory, and database remain strictly on your machine."*
- **RA-7 — Touch Target Sizing (WCAG 2.5.5 / M40 Token Alignment)**:
  The `FeedbackButton` and all interactive controls inside `FeedbackModal` (Textarea, Close, Send, Cancel) must satisfy the minimum 44px touch target requirement (`min-h-11`, `h-11`, or `h-12 w-12` for the circular button).
- **RA-8 — Scope Guardrail Method**:
  Working tree is clean at commit `7515036` (Milestone 42 completion). `git diff --name-only 7515036 -- apps packages README.md .env.production` is viable and must return **only** the authorized files listed in Section 1.

---

## 1. Data Schema & Contracts

### 1.1 Exported Constants & Environment Variables
In `apps/api/src/config.ts`:
```typescript
export const ENV_FEEDBACK_WEBHOOK_URL = 'TRUCHABREW_FEEDBACK_WEBHOOK_URL';
```

In `apps/api/src/config.ts` (`RuntimeConfig`):
```typescript
export interface RuntimeConfig {
  dbPath: string;
  migrationsDir: string;
  staticRoot: string;
  port: number;
  host: string;
  feedbackWebhookUrl?: string; // NEW in M43_P1
}
```

In `packages/shared-types/src/feedback.ts` (NEW):
```typescript
export interface FeedbackViewport {
  width: number;
  height: number;
}

export interface FeedbackContext {
  appVersion: string;
  route: string;
  viewport: FeedbackViewport;
  batchId?: string;
  batchName?: string;
  batchStage?: string;
}

export interface FeedbackInput {
  message: string;
  context: FeedbackContext;
}

export interface FeedbackResponse {
  success: boolean;
  timestamp: string;
}

export interface OutboundWebhookPayload {
  content: string;
  text: string;
  feedback: {
    message: string;
    timestamp: string;
    context: FeedbackContext;
  };
}
```

### 1.2 REST API Contract
- **Endpoint**: `POST /api/feedback`
- **Request Body**:
```json
{
  "message": "Mash temperature dropped 2C faster than expected",
  "context": {
    "appVersion": "0.1.0",
    "route": "/batches/b-123",
    "viewport": { "width": 375, "height": 812 },
    "batchId": "b-123",
    "batchName": "Centennial IPA",
    "batchStage": "Brewing"
  }
}
```
- **Response 200 OK**:
```json
{
  "success": true,
  "timestamp": "2026-09-07T17:30:00.000Z"
}
```
- **Response 400 Bad Request**:
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "body/message must NOT have fewer than 1 characters"
  }
}
```
- **Response 502 Bad Gateway**:
```json
{
  "error": {
    "code": "FEEDBACK_DELIVERY_FAILED",
    "message": "Outbound webhook responded with status 500"
  }
}
```
- **Response 503 Service Unavailable**:
```json
{
  "error": {
    "code": "FEEDBACK_NOT_CONFIGURED",
    "message": "Feedback webhook destination is not configured on this server"
  }
}
```

### 1.3 Symbol Inventory & Authorized Files
**Authorized Files (15 files maximum)**:
1. `packages/shared-types/src/feedback.ts` [NEW]
2. `packages/shared-types/src/index.ts` [MODIFIED - export * from './feedback']
3. `apps/api/src/config.ts` [MODIFIED - add ENV_FEEDBACK_WEBHOOK_URL and runtime resolution]
4. `apps/api/src/routes/feedback.ts` [NEW - registerFeedbackRoutes]
5. `apps/api/src/server.ts` [MODIFIED - register feedback routes]
6. `apps/api/src/index.ts` [MODIFIED - pass config/feedbackWebhookUrl into buildServer and load env files]
7. `apps/api/test/feedback.test.ts` [NEW - comprehensive API integration tests]
8. `apps/api/test/config.test.ts` [MODIFIED - test ENV_FEEDBACK_WEBHOOK_URL resolution]
9. `apps/web/src/api/client.ts` [MODIFIED - export sendFeedback API method]
10. `apps/web/src/components/FeedbackModal.tsx` [NEW - feedback form, disclosure, non-destructive error handling]
11. `apps/web/src/components/FeedbackButton.tsx` [NEW - 44px thumb-friendly floating button]
12. `apps/web/src/App.tsx` [MODIFIED - render FeedbackButton & FeedbackModal in shell with active view/batch context]
13. `apps/web/test/feedback.test.tsx` [NEW - unit & UI integration tests]
14. `README.md` [MODIFIED - document TRUCHABREW_FEEDBACK_WEBHOOK_URL in config section]
15. `.env.production` [NEW - committed default config with TruchaBrew Bot Slack webhook URL]

---

## 2. Transformations & Pure Logic

### 2.1 Context Gathering (`getFeedbackContext`)
Pure helper function in `apps/web/src/components/FeedbackModal.tsx` or `apps/web/src/utils/feedback.ts`:
```typescript
export function getFeedbackContext(
  view: string,
  batchMeta?: { id: string; name: string; stage?: string }
): FeedbackContext {
  return {
    appVersion: '0.1.0',
    route: window.location.pathname || view,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    ...(batchMeta
      ? {
          batchId: batchMeta.id,
          batchName: batchMeta.name,
          batchStage: batchMeta.stage,
        }
      : {}),
  };
}
```

### 2.2 Outbound Webhook Formatter (`buildOutboundPayload`)
Pure helper function in `apps/api/src/routes/feedback.ts`:
```typescript
export function buildOutboundPayload(
  input: FeedbackInput,
  timestamp: string
): OutboundWebhookPayload {
  const ctx = input.context;
  const batchInfo = ctx.batchName
    ? ` • Batch: **${ctx.batchName}** (${ctx.batchStage ?? 'Unknown'})`
    : '';

  const content = [
    '📢 **TruchaBrew Feedback**',
    `> ${input.message.replace(/\n/g, '\n> ')}`,
    '',
    `**Context:** App \`${ctx.appVersion}\` • Route \`${ctx.route}\` • Viewport \`${ctx.viewport.width}x${ctx.viewport.height}\`${batchInfo}`,
  ].join('\n');

  return {
    content,
    text: `TruchaBrew Feedback: ${input.message}`,
    feedback: {
      message: input.message,
      timestamp,
      context: ctx,
    },
  };
}
```

### 2.3 Stateful Modal Lifecycle & Non-Destructive Error Handling
- **Initial State**: `isOpen: false`, `message: ''`, `isSending: false`, `error: null`, `success: false`.
- **Open Action**: Opens modal, focuses textarea, retains any previously unsubmitted message.
- **Submit Action**:
  1. Sets `isSending: true`, `error: null`.
  2. Invokes `api.sendFeedback({ message, context })`.
  3. **On Success**:
     - Sets `success: true`, `isSending: false`.
     - Displays confirmation message.
     - Resets `message: ''`.
     - Automatically closes after 1.5s (or upon user clicking "Close").
  4. **On Failure**:
     - Sets `isSending: false`, `error: err.message`.
     - **Keeps `message` state completely intact in textarea**.
     - Focuses or keeps focus on textarea so brewer can adjust or retry.
- **Close Action**: Closes dialog without clearing `message` if an error occurred, so reopening preserves the unsubmitted draft.

---

## 3. Acceptance Criteria & Test Matrix

| ID | Requirement | Test Type | Expected Outcome |
|---|---|---|---|
| AC-1 | Constant export `ENV_FEEDBACK_WEBHOOK_URL` | Unit Test | `ENV_FEEDBACK_WEBHOOK_URL === 'TRUCHABREW_FEEDBACK_WEBHOOK_URL'`, exported from `apps/api/src/config.ts` |
| AC-2 | `resolveConfig` feedback webhook parsing | Unit Test | Parses trimmed non-empty string into `feedbackWebhookUrl`; treats unset, empty, and whitespace-only as `undefined` |
| AC-3 | `POST /api/feedback` validation — empty message | Unit Test | Submitting empty message `{ message: "" }` returns HTTP 400 with code `VALIDATION_FAILED` |
| AC-4 | `POST /api/feedback` validation — whitespace message | Unit Test | Submitting whitespace `{ message: "   \n " }` returns HTTP 400 with code `VALIDATION_FAILED` |
| AC-5 | `POST /api/feedback` validation — message > 5000 chars | Unit Test | Submitting message of 5001 chars returns HTTP 400 |
| AC-6 | `POST /api/feedback` unconfigured returns 503 | Integration Test | When `feedbackWebhookUrl` is explicitly undefined, `POST /api/feedback` returns HTTP 503 with error code `FEEDBACK_NOT_CONFIGURED` |
| AC-7 | `POST /api/feedback` outbound forward success | Integration Test | When `feedbackWebhookUrl` is set (or loaded from default), forwards POST to mock webhook server with JSON payload and returns HTTP 200 `{ success: true, timestamp }` |
| AC-8 | Outbound webhook dual format | Unit Test | Outbound payload contains top-level markdown `content`, plaintext `text`, and structured `feedback` object |
| AC-9 | `POST /api/feedback` delivery failure returns 502 | Integration Test | When outbound fetch returns HTTP 500 or network connection refused, API returns HTTP 502 with code `FEEDBACK_DELIVERY_FAILED` |
| AC-10 | Outbound delivery timeout | Integration Test | Outbound fetch times out after 10s and returns HTTP 502 `FEEDBACK_DELIVERY_FAILED` without hanging server |
| AC-11 | Privacy guarantee: no forbidden telemetry | Unit Test | Outbound payload contains strictly message and declared context; contains zero IP address, host path, or recipe details |
| AC-12 | `FeedbackButton` mobile touch target size >= 44px | Component Test | `FeedbackButton` computes to at least 44x44px target size (`min-h-11 min-w-11` / `h-12 w-12`) |
| AC-13 | `FeedbackButton` positioning & visibility | Component Test | Renders with `fixed bottom-4 right-4 z-40`, visible on both desktop and mobile viewports |
| AC-14 | `FeedbackModal` open/close toggle | Component Test | Clicking `FeedbackButton` opens `FeedbackModal`; clicking close/cancel or pressing Escape closes it |
| AC-15 | `FeedbackModal` accessibility & dialog semantics | Component Test | Modal has `role="dialog"`, `aria-modal="true"`, accessible label, and uses `useModalA11y` focus trap |
| AC-16 | Honest privacy disclosure in modal | Component Test | Modal renders text clearly disclosing that only message and technical screen context are sent, with no recipes/database transmitted |
| AC-17 | Non-destructive error handling | Component Test | When `sendFeedback` rejects, error banner is displayed and typed message remains in textarea |
| AC-18 | Success feedback flow | Component Test | When `sendFeedback` resolves, success banner is displayed, message is cleared, and modal closes |
| AC-19 | Technical context extraction with active batch | Component Test | Submitting feedback while viewing a batch includes `batchId`, `batchName`, and `batchStage` in context |
| AC-20 | Technical context extraction without active batch | Component Test | Submitting feedback on non-batch screens (e.g. recipe list) includes view, appVersion, and viewport without batch fields |
| AC-21 | Four Layer 1 gates green | Verification | `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` all exit 0 |
| AC-22 | Scope guardrail | Verification | `git diff --name-only 7515036 -- apps packages README.md .env.production` contains **only** the 15 authorized files |

---

> **HALT GATE (STATE 2):**
> Review this feature specification. Reply with **SPEC_APPROVED** to begin execution.
