$ErrorActionPreference = 'Stop'
& 'C:\Users\yixin\Documents\code\lp-generator\server\.venv\Scripts\python.exe' 'C:\Users\yixin\Documents\Codex\2026-10-04\task\resources\server\scripts\run_resource_benchmark_env.py' --env-file 'C:\Users\yixin\Documents\code\lp-generator\.env' --result-root 'C:\Users\yixin\Documents\Codex\2026-10-04\task'
if ($LASTEXITCODE -ne 0) { throw 'Benchmark stopped; review the sanitized report and preserve the shared ledger.' }
