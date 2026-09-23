# CHG-172 R3 evidence binding validation

- The accepted Product candidate is `949695c79753990080309907502e33cd29eb00e1` with tree `6eed4a44bbe2680a856159ff4716da7183a018b7`; it descends from protected `main` base `9dd9c4b0a37b804868487cf63a169faf807cdaf1` (tree `5b0b1abf96b7b13da4443d6698ce791419f658e0`).
- R1 and R2 source branches both equal the accepted candidate. Their artifact and native evidence commits each have an empty parent list and are preserved unchanged.
- R1 `release:verify` is PASS. Its immutable package manifest SHA-256 is `d1d58ebccb9072e1220d502295ba6a0cc2b6e10d0d5815cde872380372bf8ff2`; bundle SHA-256 is `7700b2a151a4c9d34d8de9bf9184ba7d67d0664a211a2d860b60b3881837f5a3`.
- R2 references the same 47 R1 PNGs exactly once; their paths and SHA-256 values match R1. All 22 critical sources have 100% coordinate coverage, zero gaps, and zero missing pixels across 926 tiles.
- This VERIFY preserves the candidate and makes no Product source change or Product commit. No browser, Expo, Playwright, or app server is launched.
- The R3 artifact commit is required to have the accepted candidate as its sole parent. The native evidence ref is owned by Fabric and is required to use the same sole parent and standard native Git schema. Project OS independently audits the resulting binding before promotion routing.
