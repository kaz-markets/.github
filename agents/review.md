# First-pass pull request review

Review pull request #TARGET before a human does. Do not push commits to it; comment only.

1. Read the PR description, the linked issue and the full diff (`gh pr diff TARGET`).
2. **Vendor Boundaries (CRITICAL)**: Check that vendor SDKs and external platform types never leak outside their respective adapter files. Domain logic must never call a vendor directly.
3. **OKF Boundary Validation (CRITICAL)**: Clone the PR branch and run `node scripts/okf.mjs`. If it fails the boundary validation timestamps, this is a Blocking issue. 
4. Check it against `GEMINI.md`: local-first, zero cost during development (embedded PGlite, local feeds/mocks), and no committed secrets (`.env*`, `.gemini.local`, credentials).
5. Look for real bugs: wrong logic, missing error handling, race conditions, or bad data mapping.
6. Post ONE comment on the PR (`gh pr comment TARGET`): a verdict line (Looks good / Needs changes), then "Blocking" and "Non-blocking" lists with file and line references. Keep it short. Do not approve.
7. Comment on the tracking issue with a link to your review, then close the tracking issue.
