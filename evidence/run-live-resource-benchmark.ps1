param([switch]$TestHandoff)

# User-entered credentials stay in memory, never in files/arguments/logs.
$ErrorActionPreference = 'Stop'
$serverPath = 'C:\Users\yixin\Documents\Codex\2026-10-04\task\resources\server'
$pythonPath = 'C:\Users\yixin\Documents\code\lp-generator\server\.venv\Scripts\python.exe'
$scriptPath = Join-Path $serverPath 'scripts\benchmark_resources.py'
$resultRoot = 'C:\Users\yixin\Documents\Codex\2026-10-04\task'
$ledgerPath = Join-Path $resultRoot 'resource-benchmark-budget.json'
$smokePath = Join-Path $resultRoot 'resource-benchmark-smoke.json'
$livePath = Join-Path $resultRoot 'resource-benchmark-live.json'
$plaintextKey = $null
$keyEntry = $null

function Invoke-KeyChild([string[]]$benchmarkArguments) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $pythonPath
    $info.WorkingDirectory = $serverPath
    $info.UseShellExecute = $false
    # Explicit child environment; the parent environment is not modified.
    $info.EnvironmentVariables['OPENAI_API_KEY'] = $plaintextKey
    $info.EnvironmentVariables['PYTHONPATH'] = $serverPath
    if ($info.PSObject.Properties.Name -contains 'ArgumentList') {
        foreach ($item in $benchmarkArguments) { $info.ArgumentList.Add($item) }
    } else {
        # Fixed local paths/flags/probe have no embedded double quotes.
        $info.Arguments = ($benchmarkArguments | ForEach-Object { '"' + $_ + '"' }) -join ' '
    }
    $child = [Diagnostics.Process]::new()
    $child.StartInfo = $info
    try {
        if (-not $child.Start()) { throw 'Child launch failed' }
        $child.WaitForExit()
        return $child.ExitCode
    } catch {
        throw 'Could not launch the benchmark child process. No key details are included.'
    } finally {
        $info.EnvironmentVariables.Remove('OPENAI_API_KEY')
        $child.Dispose()
    }
}

try {
    if ($TestHandoff) {
        $keyEntry = ConvertTo-SecureString 'synthetic-in-memory-test-not-a-key' -AsPlainText -Force
    } else {
        $keyEntry = Microsoft.PowerShell.Utility\Read-Host 'Existing authorized OpenAI benchmark key (hidden)' -AsSecureString
    }
    $keyBuffer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($keyEntry)
    try {
        $plaintextKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyBuffer).Trim()
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyBuffer)
    }
    if ([string]::IsNullOrWhiteSpace($plaintextKey)) {
        throw 'The secure prompt did not produce a nonempty key. No benchmark or API call started. Run the launcher again.'
    }
    $probe = "import os,sys; sys.exit(0 if os.environ.get('OPENAI_API_KEY','').strip() else 1)"
    if ($TestHandoff) {
        $probe = "import os,sys; sys.exit(0 if os.environ.get('OPENAI_API_KEY') == 'synthetic-in-memory-test-not-a-key' else 1)"
    }
    $probeExit = Invoke-KeyChild -benchmarkArguments @('-c', $probe)
    if ($probeExit -ne 0) { throw 'The child did not receive the key. No API call started.' }
    if ($TestHandoff) {
        Write-Output 'Synthetic handoff passed: child received dummy; no network or benchmark calls; no key logged or stored.'
        return
    }
    Write-Output 'Secure child handoff verified. Starting smoke within the shared $5 total budget.'
    $smokeExit = Invoke-KeyChild -benchmarkArguments @($scriptPath, '--live', '--smoke', '--cap', '5', '--ledger', $ledgerPath, '--output', $smokePath)
    if ($smokeExit -ne 0) { throw 'Native preflight could not complete. Preserve the budget ledger.' }
    $smoke = Get-Content -LiteralPath $smokePath -Raw | ConvertFrom-Json
    $hasResources = @($smoke.observations | Where-Object { $_.temperature -eq 'cold' -and $_.status -eq 'measured' -and $_.resource_count -gt 0 }).Count -gt 0
    $hasSearch = @($smoke.calls | Where-Object { $_.status -eq 'success' -and $_.search_calls -gt 0 }).Count -gt 0
    if (-not $hasResources -or -not $hasSearch) { throw 'Native preflight did not return sourced resources. Full run stopped. Share only the nonsecret smoke report; preserve the ledger.' }
    $fullExit = Invoke-KeyChild -benchmarkArguments @($scriptPath, '--live', '--cap', '5', '--ledger', $ledgerPath, '--output', $livePath)
    if ($fullExit -ne 0) { throw 'Benchmark could not complete. Preserve the budget ledger and nonsecret reports.' }
    Write-Output "Nonsecret reports: $smokePath and $livePath"
} finally {
    $plaintextKey = $null
    if ($keyEntry) { $keyEntry.Dispose() }
}
