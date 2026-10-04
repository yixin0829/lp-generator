# Onboarding acceptance evidence

First-time visitors on Home or a learning-path page see three short steps: enter a topic, use Graph/List, then choose one concept and a small learning action. The unchecked-by-default “Don’t show this again” checkbox is the only durable opt-out. Closing, skipping, or completing without selecting it dismisses the guide for the current app visit; it returns on reload/next visit. The persistent How to use control replays from step one. Replaying allows an existing opt-out to be unchecked and removed.

The native modal has an accessible title/description, keyboard focus wrapping, Escape dismissal, and replay-trigger focus restoration. Storage failures keep the active theme usable and report an unsaved opt-out instead of pretending it persisted. Feedback now asks for product feedback and links topic seekers to Home.

## Validation

- `npm run test`: 5 existing frontend tests passed.
- `npm run test:e2e`: 9 browser acceptance tests passed using Playwright 1.57.0/installed Chromium. Checks cover completion/back, unchecked reload behavior, explicit opt-out across reload/new tab, replay/re-enabling, Escape, keyboard focus, repeated navigation, feedback routing, failed storage (including failed removal of an existing opt-out), desktop/mobile/dark layouts.
- `npm run build`: passed, including prerendering 30 routes and SEO verification of 27 canonical pages.
- Backend regression suite: 54 tests passed using the existing Python environment.
- Backend lint/format checks were run and have pre-existing failures: F541 at `server/app/main.py:47`; formatting in five unchanged files (`app/routers/shares.py`, `app/services/learning_path_service.py`, `tests/test_routers_learning_paths.py`, `tests/test_routers_shares.py`, `tests/test_services_learning_path.py`). This PR changes no backend source.
- The frontend defines no separate lint or typecheck script. Production compilation, existing unit tests, and browser checks passed.
- `git diff --check`: passed.

Screenshots were captured from real browser rendering with only the generation counter/API response mocked and external requests blocked. No paid API request occurred. This is local acceptance evidence, not a production smoke test.

## Screenshots

| View | Initial | Explicit checkbox | Returning after opt-out | Replay |
| --- | --- | --- | --- | --- |
| Desktop, 1440×1000 | [Initial](onboarding-desktop-initial.png) | [Checkbox](onboarding-desktop-optout.png) | [Returning](onboarding-desktop-returning.png) | [Replay](onboarding-desktop-replay.png) |
| Mobile, 390×844 | [Initial](onboarding-mobile-initial.png) | [Checkbox](onboarding-mobile-optout.png) | [Returning](onboarding-mobile-returning.png) | [Replay](onboarding-mobile-replay.png) |
| Dark mobile, 390×844 | [Initial](onboarding-dark-mobile-initial.png) | [Checkbox](onboarding-dark-mobile-optout.png) | [Returning](onboarding-dark-mobile-returning.png) | [Replay](onboarding-dark-mobile-replay.png) |

Run screenshots/tests again with `cd client; npm run test:e2e` after installing dependencies and `npx playwright install chromium`. `PLAYWRIGHT_BROWSERS_PATH` or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing installation. Screenshots contain demonstration UI only, with no user feedback, credentials, or personal submissions.

Review correction: an unsaved change to an existing opt-out now stays open with an error and a retry/keep-previous-setting action. First-time users with no saved opt-out can still dismiss when storage is unavailable. Browser tests use strict port 4177 and never reuse an unrelated development server.
