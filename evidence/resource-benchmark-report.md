# Concept resources: implementation and benchmark report

## Decision

Resource discovery is a separate, on-demand action. Generating or reading a learning path never waits for resources. The default is a small curated catalogue with no provider charge. Native OpenAI web search and catalogue-first native fallback are implemented behind `RESOURCE_PROVIDER=web_search` or `hybrid`; neither is enabled by this PR. No production/staging configuration was changed.

**Live native-search benchmarking is blocked by missing authorized benchmark credentials.** The execution process has no `OPENAI_API_KEY`; production Secret Manager payloads and local secret files were not read. US$5 is authorized, but actual provider spend so far is **US$0**. This report deliberately separates measured local timings, blocked measurements, and price projections. Do not merge on the assumption that native search has been tested live.

## Approaches compared

| Approach | Cost | Speed evidence | Coverage and tradeoff |
| --- | --- | --- | --- |
| Curated catalogue | Measured provider charge $0 | Local in-process cold median 0.0432 ms, p95 0.1180 ms; warm median 0.0042 ms, p95 0.0071 ms | 18/36 cold observations return two resources (six of 12 topics, three repetitions). Deterministic and safe but intentionally narrow; broader subjects need editorial additions. These are lookup timings, not HTTP/page-load latency. |
| OpenAI native `web_search` | Unmeasured. Projected baseline $0.0132/search before ordinary prompt/output tokens on gpt-4.1-mini | No measured latency; 36 cold jobs explicitly blocked | Broader live discovery from a vetted publisher allowlist. Actual coverage, citations, compatibility, and latency require the authorized live run. A mocked provider test is not live evidence. |
| Catalogue-first native fallback (`hybrid`) | Catalogue hits measured at $0; misses unmeasured. Under this 50%-hit manifest, projected search charges are half native-only | Catalogue-hit subset: cold median 0.0469 ms, p95 0.0901 ms; warm median 0.0048 ms, p95 0.0104 ms. Eighteen miss jobs blocked | Composition of the first two approaches, not a third independent search engine. Fast hits with broader paid fallback; full hybrid performance is not measured. |
| Brave Search API plus deterministic filtering/model ranking | Estimate only: $0.005/search plus model tokens | Not measured; no Brave credential/setup authorized | Independent alternative provider. Not integrated and no signup/access expansion performed. Useful comparison if later authorized. |

Official pricing sources: [OpenAI pricing](https://developers.openai.com/api/docs/pricing), [gpt-4.1-mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [native web search](https://developers.openai.com/api/docs/guides/tools-web-search), [Brave Search API](https://brave.com/search/api/).

The researched gpt-4.1-mini rates are $0.40/M input, $0.10/M cached input, and $1.60/M output tokens. Native search is $0.01/tool call plus a fixed 8,000 search-content input tokens on this model ($0.0032), giving the $0.0132 baseline. Eagerly searching 20 concepts would start at $0.264/path before ordinary tokens; this implementation avoids eager search. With 10,000 ordinary input tokens and 1,200 output tokens, an illustrative request would be $0.01912; this is a projection, not observed usage. Price assumptions must be rechecked before running later.

## Reproduction and spending controls

The frozen manifest has 12 benign topic/concept pairs: Python/Loops, JavaScript/Closures, React/State, SQL/Joins, Guitar/Chords, Photography/Exposure, Pottery/Glazing, Beekeeping/Hive inspection, Question asking/Clarifying assumptions, Turkish/Vowel harmony, Hydrogeology/Aquifer tests, and Cooking/Emulsification. Catalogue version is `2026-10-04-v1`. Three repetitions per strategy are ordered with fixed seed 20261004, sequentially. Each job uses a fresh application cache for cold measurement, followed by a warm lookup. Percentiles on these small samples are exploratory.

From `server`, set `PYTHONPATH` to that directory and run the existing Python environment:

```text
python scripts/benchmark_resources.py
python scripts/benchmark_resources.py --live --smoke --cap 5 --ledger /absolute/shared-budget.json --output /absolute/smoke.json
python scripts/benchmark_resources.py --live --cap 5 --ledger /absolute/shared-budget.json --output /absolute/live.json
```

Live mode requires a valid key securely provided as `OPENAI_API_KEY` to that process. Do not put it in chat, source, command arguments, output, or the report. No new credentials or permissions are created by this harness. An absent key stops live mode before an API call. Current results in `resource-benchmark.json` are the no-key run.

The harness uses gpt-4.1-mini's dated snapshot, `max_retries=0`, a request timeout, at most one tool call, and an 800-token output cap. Before each attempted call it reserves $0.10 against a hard maximum of $5, retaining $0.20 headroom. Reservations are persisted before each call in a shared ledger. Use the same absolute --ledger path for smoke, full runs, retries, and restarts: the $5 approval is TOTAL, not per invocation. Never delete/reset the ledger to retry. An exclusive lock blocks concurrent runs; after interruption it fails closed until the owner confirms the old process stopped and resolves its lock while preserving the ledger. Successful replies record actual returned usage/tool counts and a conservative calculated cost; failed calls with unknown usage retain the full reservation and error type only. Raw responses, keys, and source text are not exported. The cost calculation adds the fixed search-content charge even if those tokens are already included in returned usage, intentionally giving an upper bound rather than undercounting. Cached-token discounts are also omitted. This is calculated metering, not invoice verification.

The benchmark cannot yet support a measured native-vs-hybrid latency or cost recommendation. Secure runtime credential access is the remaining step; --smoke now runs one native React/State preflight (cold call plus warm cache). Confirm measured status, at least one sourced resource, and a real search call before the full paid run. The secure user command gates the full run on those checks and shares the ledger. No paid benchmark was run with mocks.

## Resource quality and safety

Cards show title, publisher, guide format, path level (not an independently verified course difficulty), why it fits, provenance, and date. Catalogue entries are two sources each for six subjects. Some are subject-level guides, not perfectly tailored lessons for every concept. Native results must be both actual tool sources and URL citations, then pass a vetted-publisher HTTPS policy. Model-generated arbitrary URLs cannot become cards. Duplicate resource identities are removed. Credentials, IP/private destinations, non-HTTPS, arbitrary domains, ports, and malformed URLs are rejected. Validated navigation URLs preserve course-ID query parameters and concept anchors. A separate identity removes only known tracking parameters, retaining distinct course IDs and anchors. No discovered URL is fetched server-side, so source content cannot trigger SSRF or instructions. React renders source strings as text; browser tests confirm literal malicious titles and reject dangerous links.

The 12 fixed catalogue URLs were independently checked with bounded HEAD requests, without following redirects: **eight returned HTTP 200; four returned HTTP 403** (JustinGuitar's two pages, Nikon, and OpenLearn photography). Those four are **unverified by this check, not proven dead**; publisher provenance and URL policy are confirmed. The full statuses are in `resource-link-checks.json`. Native source reachability/content quality remains unverified until the live run. Coverage and credible-source provenance are not proof of pedagogical usefulness; editorial review remains valuable.

Process-local cache keys include topic, concept, level, language, provider, and catalogue/prompt/schema versions. Cache entries last one day, with a 256-entry bound and concurrent-request deduplication. Each Cloud Run process has its own cache; this is not shared durable caching. Missing providers, empty catalogue coverage, loading, failure, and retry remain independent of the path. Topic/concept changes abort stale UI requests. Backend authentication and a 5/minute endpoint limit apply.

## Validation and screenshots

- Backend: 71 tests pass, including 17 resource/budget tests for validation, provider absence, unsafe URLs, cited-source membership, duplicates, malicious source text, concurrency/cache behavior, and independent provider failure.
- Frontend: five existing tests pass. The nine onboarding browser checks and final six resource browser checks pass (15 total cases), including stale-request cancellation, retry/empty states, and literal malicious titles/unsafe URLs.
- Production frontend build, 30-route prerendering, and 27-canonical-page SEO verification pass.
- New/changed backend files pass Ruff. Full baseline lint/format retains the unchanged failures documented in `README.md`; no frontend lint/typecheck command is configured.
- Browser screenshots use API fixtures, clearly separate from measured catalogue lookup data and blocked live-search data. [Desktop](resources-desktop.png), [mobile](resources-mobile.png), [dark mobile](resources-dark-mobile.png).

PR1 contains first-time onboarding and opt-out/replay evidence. PR2 stacks on its branch and adds only resource behavior, tests, benchmark tooling, and this evidence. No merge, production deployment, database write, key extraction, or external provider setup was performed. The original dev checkout remains unchanged.

Deployment caveat: the resource limiter uses get_remote_address, like the existing app. Its 5/minute bucket is a coarse upstream-IP safeguard; Vercel proxy users can share that bucket. It is neither verified per-user identity nor a deployment-wide spend quota, and multiple worker processes can have separate buckets/caches. No spoofable forwarded header is trusted. Native search remains disabled by default; before enabling it for a public rollout, choose an authenticated quota design and validate proxy traffic behavior. The present default-catalogue preview is not evidence of paid-provider rollout readiness.
