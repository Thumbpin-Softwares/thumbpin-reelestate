# Thumbpin Credit System (Production Spec)

## 1) Goals

This document defines the production credit architecture for all generation surfaces in Thumbpin.

Primary goals:
- Prevent runaway API cost.
- Keep free-tier onboarding simple.
- Guarantee safe debit/refund behavior under failures.
- Provide auditable credit transaction history.
- Keep pricing/policy consistent across backend and UI.

## 2) Canonical Policy

### Free tier (new users)
- **Paid credits at signup:** `0`
- **Free video quota:** `2` generations total (across all video variants)
- **Free avatar quota:** `2` generations total (across all avatar variants)

### Pro tier
- Uses paid credits as primary balance.
- Subscription recharge can add monthly credits (example: 500/month).

### Paid credit top-ups
- Users can purchase predefined server-side packs.
- Credits are added after successful webhook validation.

## 3) Data Model

## User fields
Source of truth: `src/models/User.js`

- `credits: number` (default `0`)
- `plan: "free" | "pro"`
- `freeVideoGenerationsUsed: number` (default `0`)
- `freeAvatarGenerationsUsed: number` (default `0`)

## Credit ledger model
Source: `src/models/CreditTransaction.js`

Stores every debit/refund/top-up event:
- `userId`
- `action`
- `eventType` (`free_quota_consumed`, `credits_debited`, `credits_refunded`, `credits_added`, ...)
- `mode` (`free_quota`, `paid_credits`, `system`)
- `creditsDelta`
- `balanceAfter`
- `metadata`

## Webhook idempotency model
Source: `src/models/WebhookEvent.js`

Used to ensure Razorpay events are processed exactly once:
- Unique index on `(provider, eventId, eventType)`

## 4) Centralized Enforcement Layer

Source: `src/lib/credit-system.js`

Core primitives:
- `consumeCreditsForAction({ userId, action, metadata })`
- `refundCreditsForAction({ userId, action, debit, metadata })`
- `addCredits({ userId, amount, action, metadata })`

Behavior:
1. For `free` users, if action has a free bucket (`video`/`avatar`) and quota remains, consume quota slot.
2. Otherwise debit paid credits atomically.
3. If debit cannot be made, return structured `402` payload.
4. On provider or pipeline failure, refund exactly what was consumed:
   - Restore free slot for quota-based debit.
   - Re-credit paid balance for paid debit.

## 5) Action Cost Matrix

Canonical action map in `src/lib/credit-system.js`:

| Action Key | Cost | Free Bucket | Notes |
| :--- | :---: | :---: | :--- |
| `generate_video` | 2 | `video` | Legacy talking-head generate flow |
| `text_to_video` | 2 | `video` | Multi-model text-to-video |
| `image_to_video` | 2 | `video` | Animate image into video |
| `ai_walkthrough` | 2 | `video` | Walkthrough Veo flow |
| `product_video` | 1 | `video` | Product Veo generation |
| `real_estate_video` | 3 | `video` | Real estate Veo generation |
| `avatar_photo` | 1 | `avatar` | HeyGen photo avatar |
| `avatar_looks` | 1 | `avatar` | HeyGen look generation |
| `product_avatar_image` | 1 | `avatar` | Gemini avatar image generation |
| `image_generation` | 1 | — | Generic image generation |
| `gemini_image_generation` | 1 | — | Gemini/Pollinations image flow |
| `avatar_group_training` | 25 | — | HeyGen custom avatar training |
| `digital_twin_training` | 25 | — | HeyGen digital twin training |

## 6) Route Coverage

Implemented generation enforcement:
- `/api/generate`
- `/api/text-to-video`
- `/api/image-to-video`
- `/api/image-gen`
- `/api/gemini-image`
- `/api/ai-walkthrough/generate`
- `/api/product-video/generate`
- `/api/real-estate-video/generate`
- `/api/avatar/generate-photo`
- `/api/avatar/generate-looks`
- `/api/product-video/generate-avatar`
- `/api/avatar/train-group`
- `/api/real-estate-video/train-twin`

Each route:
- Validates input first.
- Consumes credits before external provider call.
- Refunds on provider/pipeline failure.

## 7) Payment & Recharge (Razorpay)

### Order creation
Source: `src/app/api/create-order/route.js`

- Requires authenticated session.
- Accepts `packId`, not arbitrary amount.
- Resolves amount/credits from server-side pack table.
- Stamps order notes with `user_id`, `credits`, `pack_id`.

### Webhook processing
Source: `src/app/api/webhooks/razorpay/route.js`

- Signature is mandatory (`RAZORPAY_WEBHOOK_SECRET`).
- Duplicate event processing blocked via `WebhookEvent` unique key.
- `payment.captured` uses `addCredits(...)` for auditable top-up.
- `subscription.activated` sets user `plan` to `pro` and adds recharge credits.

## 8) UI Contract

UI should always treat backend as source of truth for:
- `credits`
- `plan`
- `freeVideoGenerationsUsed`
- `freeAvatarGenerationsUsed`

Updated marketing/product copy should reflect:
- **Free = 2 video + 2 avatar generations**, not legacy “10 free credits”.

## 9) Operational Rules

- Never trust client-provided charge amount for billing.
- Never skip webhook signature checks in production.
- Never process same webhook event twice.
- Always log debit/refund/top-up in ledger.
- Prefer atomic DB updates (`findOneAndUpdate` with conditions) for race safety.

## 10) Recommended Next Steps

1. Add admin reconciliation screen from `CreditTransaction` ledger.
2. Add scheduled monthly recharge for active pro subscriptions (if not fully webhook-driven).
3. Add alerting for high refund ratio by provider/model.
4. Add integration tests for:
   - insufficient balance,
   - free quota exhaustion,
   - provider failure refund,
   - webhook duplicate replay.
