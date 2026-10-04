# Concept resources: final measured comparison

The user-run Luna smoke and full comparison completed within the shared $5 ledger. All 72 scheduled cold jobs were attempted. Luna accepted filtered search, but 17 post-response parser failures and weak relevance on some subjects prevent a paid-provider rollout recommendation. Keep the catalogue default. No production configuration or deployment changed.

## Results

Two repetitions per strategy cover the same 12 topics, seeded sequential order 20261004. Each cold job gets a fresh application cache, then a warm lookup only after success. Timings include provider network latency for search but exclude deployed HTTP/proxy/browser latency. Warm timings are memory lookups. Failures are excluded from percentiles, creating survivor bias. Small-sample p95 is exploratory.

| Strategy | Cold attempted / completed / with cards | Cold p50 / p95 | Warm completed; p50 / p95 | Topics with cards |
| --- | --- | --- | --- | --- |
| Catalogue | 24 / 24 / 12 | 0.054 / 0.123 ms | 24; 0.00615 / 0.0127 ms | 6/12 |
| Native search | 24 / 15 / 15 | 6.391 / 9.356 s | 15; 0.0113 / 0.0158 ms | 9/12 |
| Catalogue-first native fallback | 24 / 16 / 16 | 0.0862 ms / 8.398 s | 16; 0.0108 / 0.0178 ms | 9/12 |

Catalogue returns two resources each for Python, JavaScript, React, SQL, guitar and photography. Twelve empty observations are expected misses. Hybrid completes all 12 catalogue-hit jobs and four of 12 fallback jobs; its median is dominated by free hits. Native fails 9/24 jobs (37.5%); hybrid fails 8/24 (33.3%, or 66.7% of fallback jobs). Across the comparison, 55 cold jobs complete and 17 fail. All 55 subsequent warm lookups are cached with no provider calls. Coverage means cards returned, not useful lessons independently verified.

These are three application strategies, not three independent search engines. Brave Search remains an unmeasured fourth alternative, estimated at $0.005/search plus ranking tokens; no signup, credential or integration was authorized. [Brave API](https://brave.com/search/api/).

## Configuration and remaining defects

Successful smoke: `gpt-5.6-luna`, low reasoning, required `web_search`, publisher filters, requested `max_tool_calls=1`, output cap 800, SDK retries disabled, provider timeout 18 seconds. It returned three React URLs in 5.044 seconds, with a 0.0132 ms warm lookup. The exact filtered request was accepted by the user's API environment. Learning-path generation model is unchanged. [Luna API model](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [web search](https://developers.openai.com/api/docs/guides/tools-web-search).

All 36 full-run response calls succeeded at the API level; 17 resource observations then raised `TypeError`. Failed topics: Turkish 3, cooking 4, guitar 2, photography 2, pottery 2, question asking 2, beekeeping 2. No raw payload/traceback was saved, so the exact field for each failed record is unknown. Inspection found optional source/content/annotation arrays and action objects could be null, yet were treated as iterable/present. Fixtures reproduce this failure class. The adapter now treats null/malformed containers as empty and rejects malformed citation URLs. **This correction has fixture proof only; live results have not been rerun or relabeled as fixed.** Valid empty replies remain explicit no-resource results.

The full report records 57 `web_search_call` output items across 36 responses: 15 have one, 21 have two, despite the one-call request parameter. Thus this parameter is not demonstrated as an absolute one-item guarantee. Action types were not retained, so 57 is an output-item count, not a verified billable-search count. Accounting conservatively counts those items. Deployment quotas remain necessary.

Earlier dated-mini smoke rejected `filters` with HTTP400, parameter `tools`, message `Parameter 'filters' not supported with model 'gpt-4.1-mini-2025-04-14'`. Earlier failures retain $0.20 total. A tested dated-mini capability omits filters; there is no automatic model switch/retry. Both adapters enforce approved HTTPS publisher URLs, citations, exact tool-source membership and duplicate identities.

## Cost and budget

The ledger allocates **$3.90**: $0.20 prior unknown-usage failures + $0.10 Luna smoke + $3.60 for 36 full response calls. **This is reserved accounting, not a verified $3.90 bill.** Catalogue makes zero provider calls; full native makes 24, hybrid makes 12. Hybrid halves paid responses on this deliberately half-hit manifest, not necessarily on production traffic.

Luna rates used: ordinary input $0.20/M, cached read $0.02/M, cache write $0.25/M, output $1.20/M, plus $0.01/counted search item and actual search-content tokens at input rate. Cache categories are subsets of input, not additional tokens. Output totals include reasoning. Luna does not use the older mini-only fixed 8000 search-token block. [Pricing](https://developers.openai.com/api/docs/pricing), [prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching).

Usage supplies input/output/cache counts but no separate search-content count. Every successful Luna response therefore retains $0.10. Recorded token/tool arithmetic gives a **partial estimate of $0.609809 full + $0.013116 smoke = $0.622925**, excluding unresolved search-content charges and earlier failed-call charges. Counting all search-output items may overcount non-search actions. This is neither complete billing nor a verified lower/upper billing bound. No paid calls were made to resolve it.

Harness controls: shared persistent total cap $5, pre-call $0.10 reservation, $0.20 headroom, exclusive ledger lock, no SDK retries. Missing usage remains reserved; warm cache adds no charge. Never delete/reset the ledger. `resource-benchmark-budget-snapshot.json` is archival evidence, not a restart ledger. Historical no-key results used three repetitions and remain in `resource-benchmark.json`; the completed live run used two.

## Relevance and credibility

Actual accepted URLs all passed publisher, HTTPS, citation and source-membership checks. Queries/fragments are preserved for navigation; only known tracking is removed for comparison identity. No discovered URL was fetched by the backend or this audit. Provenance does not establish correctness, availability or lesson quality.

React sources include state-a-components-memory, state-as-a-snapshot and sharing-state-between-components; Python includes its official control-flow tutorial; MDN includes closures. Paths suggest relevant first-party guides without verifying page text. Broader searches show the allowlist's weakness: beekeeping returns an MIT introductory-psychology PDF; pottery returns bio-inspired structures and glass-engineering material. General lecture lists/syllabuses are less targeted than lessons. An MDN `Functions.` path looks suspicious but was not fetched, so no broken-link claim is made. **9/12 topic coverage is not nine useful answers.**

Keep paid arbitrary-topic search disabled until relevance is evaluated and subject-specific credible publishers are added. Catalogue is deterministic but narrow. Native sources were not checked for reachability, language, difficulty or pedagogical correctness. Earlier catalogue HEAD checks found eight HTTP200 and four HTTP403; the latter are unverified, not proven dead. Cards show path level, not verified course difficulty; localized resources are not guaranteed.

## Reproduction and evidence

Saved sanitized artifacts: `resource-benchmark-smoke.json`, `resource-benchmark-live.json`, `resource-benchmark-analysis.json`, `resource-benchmark-budget-snapshot.json`. No keys, raw provider responses or source page text are exported.

The user ran `start-resource-benchmark-from-env.ps1`. Its Python runner parses exactly one OPENAI_API_KEY without interpolation/shell execution, passes it to child memory, and gates the full comparison on sourced smoke success. Agent checked only credential-file existence/ignored/untracked status, added a local Git exclusion, and never opened the credential file, inspected process secrets or initiated authenticated calls. Launcher scripts are included for review; they reference this workspace's paths and must be adapted elsewhere.

Manifest: Python/Loops, JavaScript/Closures, React/State, SQL/Joins, Guitar/Chords, Photography/Exposure, Pottery/Glazing, Beekeeping/Hive inspection, Question asking/Clarifying assumptions, Turkish/Vowel harmony, Hydrogeology/Aquifer tests, Cooking/Emulsification. Catalogue `2026-10-04-v1`, seed 20261004, two repetitions, sequential responses, fresh per-job cold cache.

Original resource screenshots are catalogue API fixtures. `resources-recorded-desktop.png` and `resources-recorded-mobile.png` replay actual successful smoke URLs through a local mocked endpoint and fixture graph. Original titles/descriptions were not retained; labels are reconstructed from URLs and visibly marked. These show rendering of recorded sources, **not live backend/browser integration or deployment**.

Validation after nullable handling: 83 backend tests pass; changed files pass Ruff. Tests preserve the onboarding preference-remove P2 correction, resource query/fragment navigation, domain/source rejection, concurrency, exact mini400 fixture, Luna request configuration, nullable arrays, persistent reservations, redaction and non-executing dotenv parsing. Frontend/browser/build results are in `README.md`.

The default remains `RESOURCE_PROVIDER=catalogue`. Optional web_search/hybrid require explicit config. App cache is process-local, one day, max256, keyed by request/model/provider/versions. The 5/minute upstream-IP limiter can be shared by proxy users and is not a verified per-user/deployment spend quota. Validate identity quotas, multiple workers, proxy behavior, accounting and relevance before paid rollout. No database mutation, production configuration change, merge or deployment occurred. `resource-benchmark-historical-notes.md` retains superseded development notes for context; this report is authoritative.
