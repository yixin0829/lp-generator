# Run this yourself in PowerShell. Enter an existing authorized key at the
# masked prompt, never in chat/source/command arguments. No secret is exported.
$ErrorActionPreference = 'Stop'
$serverPath = 'C:\Users\yixin\Documents\Codex\2026-10-04\task\resources\server'
$pythonPath = 'C:\Users\yixin\Documents\code\lp-generator\server\.venv\Scripts\python.exe'
$scriptPath = Join-Path $serverPath 'scripts\benchmark_resources.py'
$resultRoot = 'C:\Users\yixin\Documents\Codex\2026-10-04\task'
$ledgerPath = Join-Path $resultRoot 'resource-benchmark-budget.json'
$smokePath = Join-Path $resultRoot 'resource-benchmark-smoke.json'
$livePath = Join-Path $resultRoot 'resource-benchmark-live.json'
$previousKey = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'Process')
$previousPythonPath = [Environment]::GetEnvironmentVariable('PYTHONPATH', 'Process')
$keyEntry = Read-Host 'Existing authorized OpenAI benchmark key' -AsSecureString
try {
    $env:PYTHONPATH = $serverPath
    $env:OPENAI_API_KEY = [Net.NetworkCredential]::new('', $keyEntry).Password
    & $pythonPath $scriptPath --live --smoke --cap 5 --ledger $ledgerPath --output $smokePath
    if ($LASTEXITCODE -ne 0) { throw 'Native preflight could not complete. Preserve the budget ledger.' }
    $smoke = Get-Content -LiteralPath $smokePath -Raw | ConvertFrom-Json
    $hasResources = @($smoke.observations | Where-Object { $_.temperature -eq 'cold' -and $_.status -eq 'measured' -and $_.resource_count -gt 0 }).Count -gt 0
    $hasSearch = @($smoke.calls | Where-Object { $_.status -eq 'success' -and $_.search_calls -gt 0 }).Count -gt 0
    if (-not $hasResources -or -not $hasSearch) { throw 'Native preflight did not return sourced resources. Full run stopped. Share only the nonsecret smoke report; preserve the ledger.' }
    & $pythonPath $scriptPath --live --cap 5 --ledger $ledgerPath --output $livePath
    if ($LASTEXITCODE -ne 0) { throw 'Benchmark could not complete. Preserve the budget ledger and nonsecret reports.' }
    Write-Output "Nonsecret reports: $smokePath and $livePath"
} finally {
    [Environment]::SetEnvironmentVariable('OPENAI_API_KEY', $previousKey, 'Process')
    [Environment]::SetEnvironmentVariable('PYTHONPATH', $previousPythonPath, 'Process')
    $keyEntry.Dispose()
    $previousKey = $null
}
