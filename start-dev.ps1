# FixIt dev server auto-restart wrapper (Windows PowerShell)
# The Next.js 16 dev server occasionally gets OOM-killed in the 4GB cgroup.
# This wrapper restarts it automatically so the Preview Panel stays available.

$ErrorActionPreference = "Stop"
$env:NODE_OPTIONS = "--max-old-space-size=1400"

while ($true) {
    $time = Get-Date -Format "HH:mm:ss"
    Write-Host "[$time] starting next dev (webpack)..."

    # Run the dev server and append output to dev.log
    # We use Start-Process or direct execution and redirect output
    cmd /c "node node_modules\next\dist\bin\next dev -p 3000 --webpack 2>&1" | Out-File -Append -Encoding utf8 "dev.log"
    
    $exitCode = $LASTEXITCODE
    $time = Get-Date -Format "HH:mm:ss"
    Write-Host "[$time] next dev exited (code $exitCode); restarting in 3s..."
    
    Start-Sleep -Seconds 3
    
    # Kill any dangling next-server processes
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "next-server" } | Invoke-CimMethod -MethodName Terminate
    
    Start-Sleep -Seconds 1
}
