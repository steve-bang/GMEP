# Firestore TTL policies (H2) and technical collections

No GCP project exists yet (Terraform is out of scope for this run), so this is the specification the
infrastructure code must apply. `firestore.indexes.json` already declares the TTL policies in
`fieldOverrides` (`ttl: true`); `firebase deploy --only firestore:indexes` creates them in a real project.
The Emulator ignores TTL, so the code never relies on deletion having happened.

| Collection        | TTL field   | Retention                                                          | Notes                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | ----------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idempotencyKeys` | `expiresAt` | `IDEMPOTENCY_TTL_HOURS` (24 h, [Đề xuất BA], BA §8.1)              | HTTP response cache only. Firestore deletes TTL documents within ~24 h after expiry, so `runIdempotent` treats `expiresAt <= now` as absent and overwrites it. **Business uniqueness is separate**: deterministic document ids (warehouse = branch+code, config version = type+scope+date, user keys, invoice request key later) never expire with this record (FR-EIN-013, BA §8.1). |
| `rateLimits`      | `expiresAt` | window length (minutes to 2 h)                                     | login lockout and rate-limit counters; keys are hashes, never raw names or addresses                                                                                                                                                                                                                                                                                                  |
| `notifications`   | `expiresAt` | `notificationRetentionDays` (365 d), hidden in the bell after 30 d | BA §8.1                                                                                                                                                                                                                                                                                                                                                                               |
| `emailOutbox`     | `expiresAt` | 7 days                                                             | dev adapter only; contains single-use links, never expose                                                                                                                                                                                                                                                                                                                             |

Not under TTL (kept until the client decides, `[Cần xác nhận: Kế toán/Luật sư khách]`, BA §8.1):
`auditLogs`, `accessLogs`, `authTokens` (small, single use; a cleanup job can delete expired rows later),
`counters`/`numberAssignments` (numbers are never reused), all business data.

Apply manually if not using `firebase deploy`:

```bash
gcloud firestore fields ttls update expiresAt --collection-group=idempotencyKeys --enable-ttl --project=<project>
gcloud firestore fields ttls update expiresAt --collection-group=rateLimits --enable-ttl --project=<project>
gcloud firestore fields ttls update expiresAt --collection-group=notifications --enable-ttl --project=<project>
gcloud firestore fields ttls update expiresAt --collection-group=emailOutbox --enable-ttl --project=<project>
```
