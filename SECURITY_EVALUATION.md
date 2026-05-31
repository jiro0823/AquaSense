# AquaSense Security Evaluation

Generated: 2026-05-28

## Overall Assessment

AquaSense now follows the original defense-in-depth security plan and has been strengthened in the areas that mattered most for a capstone demo and a realistic production path: secrets hygiene, httpOnly cookie auth, CSRF protection, RBAC, device authentication, HTTPS enforcement, audit logging, validation, and CI security checks.

## Implemented Controls

- Secrets are excluded from Git through `.gitignore`; `.env.example` files contain placeholders only.
- A history purge script is available to remove previously committed `.env` files from Git history.
- Web authentication uses JWT-backed httpOnly cookies instead of browser-readable tokens.
- Authenticated state-changing requests require CSRF validation with `aquasense_csrf` and `X-CSRF-Token`.
- Login and signup are rate-limited to slow brute-force attempts.
- Passwords require 12+ characters with uppercase, lowercase, number, and special character.
- Password hashes are stored with bcrypt.
- Protected API routes use `authenticateToken` and RBAC roles: `admin`, `farmer`, `guest`.
- ESP32 device requests require `deviceId` plus `X-Device-Key`.
- Device IDs must be registered and active before ingestion or feeding sync/ack requests are accepted.
- Device keys are compared with timing-safe equality.
- Sensitive water dashboard, readings, thresholds, predictions, alerts, feeding, SMS, and device routes are protected.
- Production config rejects default JWT placeholders, missing device keys, and localhost CORS origins.
- Production requests require HTTPS when behind a proxy.
- CI security checks fail on committed env files, obvious secret assignments, default JWT placeholders, and unsafe production config.
- npm audit gates run in CI at `high` severity.

## Remaining Production Recommendations

- Rotate every secret that was ever committed before history purge.
- Run `scripts/purge-secrets-history.ps1` from a clean clone and coordinate a force-push.
- Upgrade vulnerable dependencies reported by `npm audit`, especially `axios`, `express` transitive `qs`, `socket.io` / `ws`, and TypeScript ESLint packages.
- Store production secrets in the hosting provider secret manager, not `.env` files.
- Add database backups and retention policy before live deployment.
- Add PostgreSQL/Supabase row-level policies if multiple farms or tenants share one database.
- Add ESP32 local buffering and replay for network outages.
- Consider account lockout or MFA for admin accounts if deployed publicly.
