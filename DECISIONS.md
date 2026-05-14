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

## 2026-05-13

Decision:
Push the MVP visual direction toward a calmer premium finance-product shell now, instead of deferring design quality until after backend work.

Reason:
The product brief is explicit that the app should feel serious, low-noise, analytical, and mobile-first. The earlier screen composition still read like a prototype even after the workflow cleanup.

Alternatives considered:
- Keep the same structure and only change colors
- Wait until real data integration is finished before improving the interface
- Add charts first to create a more "financial" feel

Tradeoff:
More front-end code now is dedicated to hierarchy, spacing, typography, and card composition. That does not solve the real-data gap, but it does create a higher-quality baseline that is worth iterating on once provider-backed signals arrive.

Temporary:
Partly. The exact styling and single-screen composition may evolve, but the design direction should remain calm, editorial, and state-led rather than loud or dashboard-noisy.

Roadmap impact:
Medium. This makes the current prototype materially more usable for on-device review while preserving the existing local-first architecture.

## 2026-05-14

Decision:
Replace the warm editorial visual language with a cleaner modern finance-app theme and a consistent sans-serif type system.

Reason:
The prior pass improved structure, but the serif headings and brown-beige palette pushed the app toward an ebook feel instead of the sharper readability users expect from products in the Robinhood, Webull, Empower, or Yahoo Finance category.

Alternatives considered:
- Keep the same layout and only swap the title font
- Add a custom downloaded font before fixing the broader visual system
- Wait for a future component library pass

Tradeoff:
System fonts are less distinctive than a branded custom family, but they are more consistent, lighter-weight, and safer for Expo Go while the app is still early. The palette change also makes the UI more conventional, which is acceptable because readability and product clarity are the priority right now.

Temporary:
Partly. The modern sans-serif direction should remain, while exact colors and elevation treatment may tighten further after dedicated detail screens and real data charts are added.

Roadmap impact:
Low to medium. This resets the visual baseline without changing product architecture or feature scope.

## 2026-05-14

Decision:
Restructure the MVP around bottom navigation and a merged builder-oriented Studio tab, instead of keeping Eyes and Recipes as separate top-level pill tabs.

Reason:
The app needs to behave more like a serious investment product on mobile. Persistent bottom navigation is easier to scan and reach one-handed, while a combined Studio better reflects how recipes, stocks, and Eyes are actually created together.

Alternatives considered:
- Keep the previous top pill navigation and only add more screens
- Split everything further into many narrow tabs
- Delay navigation restructuring until after real data integration

Tradeoff:
The app now uses a broader single-file shell with more UI state while still lacking a formal navigation library. That is acceptable for this stage because the interaction model is materially closer to production expectations and still easy to validate in Expo Go.

Temporary:
Yes. The information architecture direction should remain, but the implementation may later move to a proper stack/tab navigator once dedicated stock, Eye, and alert detail screens are added.

Roadmap impact:
Medium. This improves mobile usability immediately and creates a clearer place for future charting, news, and drill-down surfaces.
