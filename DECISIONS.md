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

## 2026-05-13

Decision:
Upgrade the prototype to Expo SDK 54 immediately after the first runnable slice.

Reason:
The target testing flow is Expo Go on a current iPhone, and the installed Expo Go client now expects SDK 54 projects.

Alternatives considered:
- Stay on SDK 53 and avoid Expo Go testing
- Use a custom development build instead of Expo Go
- Delay the upgrade until after more product work

Tradeoff:
The upgrade required coordinated dependency updates and a small TypeScript config fix, but it removes ongoing device-side compatibility friction.

Temporary:
No. Staying current with the supported Expo Go SDK is the default path unless the app later needs a custom native build.

Roadmap impact:
Low. This keeps the current local-first app launchable on target hardware without changing the product architecture.

## 2026-05-13

Decision:
Re-center the MVP around guided review surfaces and explicit selection controls instead of freeform ID-driven forms.

Reason:
The docs prioritize mobile-first usefulness and calm review. Requiring internal IDs made the first version feel like an admin tool rather than a product.

Alternatives considered:
- Keep the original tab content and only polish styling
- Add a navigation library first and postpone interaction cleanup
- Wait for backend/provider work before improving the front-end workflow

Tradeoff:
The app now spends more code on presentation and interaction state before introducing richer backend behavior, but the core loop is materially easier to use and test on device.

Temporary:
Partly. The explicit chip-based selection and guided review pattern should remain, while the exact single-screen layout may evolve once dedicated detail screens are introduced.

Roadmap impact:
Medium. This raises the floor for product usability now and gives a better base for evaluating real-data integration next.
