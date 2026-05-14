# DECISIONS

## 2026-05-13

Decision:
Use plain Expo with React Native and TypeScript for the first runnable slice.

Reason:
It is the shortest path to a launchable Expo Go build that still preserves iOS, Android, and web support.

Alternatives considered:
- Expo Router with a more structured route tree
- React Navigation
- Separate web and mobile apps

Tradeoff:
The current app uses custom in-app tab switching instead of a full navigation library, so deep linking and richer transitions are deferred.

Temporary:
Yes. Replace only if the navigation needs clearly exceed the current ROI.

Roadmap impact:
Low. The domain model and evaluation logic remain reusable if navigation changes later.

## 2026-05-13

Decision:
Persist the prototype in local AsyncStorage rather than introducing a backend or database immediately.

Reason:
The docs prioritize a runnable local vertical slice before production architecture and provider integration.

Alternatives considered:
- Expo SQLite
- Local Node backend and SQLite
- Cloud-hosted backend

Tradeoff:
This is single-device local persistence only. It does not yet satisfy the longer-term backend ownership model from the architecture brief.

Temporary:
Yes. The app data is stored behind a small load/save layer so it can later move to SQLite or an API-backed store.
