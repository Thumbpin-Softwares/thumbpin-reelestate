# Credit System Implementation Report

## Document Purpose

This report explains what was implemented in the credit-system rollout, how credits work now, which files were changed, and what behavior to expect in production.

---

## 1) Final Credit Policy (Now Active)

### Free users (new accounts)
- Paid credits at signup: **0**
- Free video quota: **2 total** (shared across all video-generation variants)
- Free avatar quota: **2 total** (shared across all avatar-generation variants)

### Pro users
- Continue using paid credits as account balance.
- Subscription activation moves plan to `pro` and adds recharge credits (currently +500 on activation event).

### Paid top-ups
- Users buy predefined server-side packs.
- Credits are granted only after valid Razorpay webhook processing.

---

## 2) Core Architecture Added

## 2.1 Centralized credit engine
Implemented in [src/lib/credit-system.js](src/lib/credit-system.js).

### Main responsibilities
- Single source of truth for charge/refund logic.
- Free-quota-first handling for free plan users.
- Atomic paid credit deduction.
- Standardized insufficient-credit response payload.
- Refund path that restores exactly what was consumed.
- Ledger logging for every debit/refund/addition.

### Main exported functions
- `consumeCreditsForAction({ userId, action, metadata })`
- `refundCreditsForAction({ userId, action, debit, metadata })`
- `addCredits({ userId, amount, action, metadata })`

### Quota constants
- `FREE_QUOTA_LIMITS.video = 2`
- `FREE_QUOTA_LIMITS.avatar = 2`

---

## 3) Data Model Changes

## 3.1 User model updated
Updated in [src/models/User.js](src/models/User.js).

### Added/changed fields
- `credits`: default changed from `5` to `0`, with `min: 0`
- `freeVideoGenerationsUsed`: new, default `0`
- `freeAvatarGenerationsUsed`: new, default `0`
- `plan`: unchanged enum (`free`/`pro`), used as canonical plan field

## 3.2 New ledger model
Added [src/models/CreditTransaction.js](src/models/CreditTransaction.js).

### Purpose
Persistent audit trail for all credit events.

### Event examples
- `free_quota_consumed`
- `credits_debited`
- `credits_refunded`
- `credits_added`
- `subscription_recharge`

## 3.3 New webhook idempotency model
Added [src/models/WebhookEvent.js](src/models/WebhookEvent.js).

### Purpose
Prevent duplicate webhook processing.

### Unique idempotency index
- `(provider, eventId, eventType)`

---

## 4) Authentication & Signup Alignment

## 4.1 Google signup defaults
Updated in [src/lib/auth-config.js](src/lib/auth-config.js).

### New default provisioning for first-time Google users
- `credits: 0`
- `freeVideoGenerationsUsed: 0`
- `freeAvatarGenerationsUsed: 0`

This aligns onboarding with “2 video + 2 avatar free quota” instead of legacy initial credits.

---

## 5) Generation Endpoints Now Enforce Credits

All listed routes now use centralized consume/refund handling and include authentication where needed.

## 5.1 Video-family routes (free bucket eligible)
- [src/app/api/generate/route.js](src/app/api/generate/route.js) → action `generate_video`
- [src/app/api/text-to-video/route.js](src/app/api/text-to-video/route.js) → action `text_to_video`
- [src/app/api/image-to-video/route.js](src/app/api/image-to-video/route.js) → action `image_to_video`
- [src/app/api/ai-walkthrough/generate/route.js](src/app/api/ai-walkthrough/generate/route.js) → action `ai_walkthrough`
- [src/app/api/product-video/generate/route.js](src/app/api/product-video/generate/route.js) → action `product_video`
- [src/app/api/real-estate-video/generate/route.js](src/app/api/real-estate-video/generate/route.js) → action `real_estate_video`

### Common behavior
1. Validate request.
2. Consume quota/credits before provider call.
3. Run generation.
4. On provider or pipeline failure, refund consumed quota/credits.

## 5.2 Avatar-family routes (free bucket eligible)
- [src/app/api/avatar/generate-photo/route.js](src/app/api/avatar/generate-photo/route.js) → action `avatar_photo`
- [src/app/api/avatar/generate-looks/route.js](src/app/api/avatar/generate-looks/route.js) → action `avatar_looks`
- [src/app/api/product-video/generate-avatar/route.js](src/app/api/product-video/generate-avatar/route.js) → action `product_avatar_image`

## 5.3 Image-only routes (paid credits, no free bucket)
- [src/app/api/image-gen/route.js](src/app/api/image-gen/route.js) → action `image_generation`
- [src/app/api/gemini-image/route.js](src/app/api/gemini-image/route.js) → action `gemini_image_generation`

Note: in Gemini-image route, when it falls back to Pollinations free provider, consumed credits are refunded.

## 5.4 Training routes
- [src/app/api/avatar/train-group/route.js](src/app/api/avatar/train-group/route.js) → action `avatar_group_training` (25)
- [src/app/api/real-estate-video/train-twin/route.js](src/app/api/real-estate-video/train-twin/route.js) → action `digital_twin_training` (25)

---

## 6) Current Cost Matrix Implemented

Defined in [src/lib/credit-system.js](src/lib/credit-system.js).

| Action | Cost | Free Bucket |
| :--- | :---: | :---: |
| generate_video | 2 | video |
| text_to_video | 2 | video |
| image_to_video | 2 | video |
| ai_walkthrough | 2 | video |
| product_video | 1 | video |
| real_estate_video | 3 | video |
| avatar_photo | 1 | avatar |
| avatar_looks | 1 | avatar |
| product_avatar_image | 1 | avatar |
| image_generation | 1 | — |
| gemini_image_generation | 1 | — |
| avatar_group_training | 25 | — |
| digital_twin_training | 25 | — |

---

## 7) Payment Security & Billing Hardening

## 7.1 Create-order route hardened
Updated in [src/app/api/create-order/route.js](src/app/api/create-order/route.js).

### What changed
- Requires authenticated session.
- No longer trusts arbitrary client `amount`/`credits`/`user_id`.
- Accepts only server-validated `packId`.
- Uses server-side `CREDIT_PACKS` map.
- Stamps order notes with validated `user_id`, `credits`, `pack_id`.

## 7.2 Razorpay webhook hardened
Updated in [src/app/api/webhooks/razorpay/route.js](src/app/api/webhooks/razorpay/route.js).

### What changed
- Signature verification is mandatory.
- Rejects missing or invalid signature.
- Adds event idempotency through `WebhookEvent` insert.
- Uses `addCredits(...)` for auditable `payment.captured` top-up.
- On `subscription.activated`:
  - sets `plan: "pro"`
  - adds subscription credits via ledgered `addCredits(...)`.

---

## 8) UI and Messaging Alignment

## 8.1 Credits page updated
Updated [src/app/app/credits/page.js](src/app/app/credits/page.js).

### Changes
- Shows free-tier usage as `videoUsed + avatarUsed` out of 4.
- Displays per-bucket counters:
  - Video quota used / 2
  - Avatar quota used / 2
- Uses canonical `profile.plan` instead of legacy `subscription_tier`.

## 8.2 Landing/pricing copy updated
- [src/components/landing/pricing.jsx](src/components/landing/pricing.jsx)
- [src/components/landing/hero.jsx](src/components/landing/hero.jsx)
- [src/components/landing/features.jsx](src/components/landing/features.jsx)
- [src/app/layout.js](src/app/layout.js)

### New public message
“Start free with **2 videos + 2 avatars**” (replacing old “10 free credits”).

## 8.3 Upgrade banner plan field fix
Updated [src/components/dashboard/upgrade-banner.jsx](src/components/dashboard/upgrade-banner.jsx).
- switched `subscription_tier` checks to canonical `plan`.

---

## 9) Security Fix Included

Updated [src/app/api/user/profile/route.js](src/app/api/user/profile/route.js).

### Fix
- Excludes `-hashedPassword` from API response (instead of `-password`).

---

## 10) Exact Runtime Flow (How credits work now)

For any integrated generation route:

1. User authenticates.
2. Route validates request payload.
3. Route calls `consumeCreditsForAction(...)` with action key.
4. Credit engine decides:
   - If free plan + bucket quota available: consume free slot.
   - Else: atomically deduct paid credits.
   - Else: return `402` structured insufficient-credit payload.
5. Provider call starts.
6. If provider succeeds: keep debit/slot consumed.
7. If provider fails or route throws: route calls `refundCreditsForAction(...)`.
8. Ledger stores event(s) in `CreditTransaction`.

This gives deterministic debit/refund behavior and auditable history.

---

## 11) Documentation Updated

- Production spec is in [docs/credit-system.md](docs/credit-system.md)
- This implementation report is in [docs/credit-system-implementation-report.md](docs/credit-system-implementation-report.md)

---

## 12) Known Remaining Work (Not part of this patch)

1. Credits page still has simulated checkout in UI handler (backend endpoints are ready, full UI wiring can be added next).
2. Existing users created before this rollout may still have legacy balances/fields; migration policy should be decided.
3. If required, add admin tooling for ledger browsing and reconciliation.
4. Add integration tests for quota exhaustion, race cases, and webhook replay.

---

## 13) Rollback Notes

If rollback is needed:
- Revert route integrations to previous direct logic.
- Revert schema defaults/counters in `User` model.
- Disable webhook idempotency model usage.

Recommended rollback strategy is staged and route-by-route, not all-at-once.

---

## 14) Final Outcome

The platform now has:
- centralized and auditable credit control,
- enforced free starter quota (`2 video + 2 avatar`),
- consistent debit/refund behavior,
- hardened payment/webhook handling,
- updated product copy aligned with actual system behavior.
