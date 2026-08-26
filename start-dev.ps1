# FixIt dev server auto-restart wrapper (Windows PowerShell)
# The Next.js 16 dev server occasionally gets OOM-killed in the 4GB cgroup.
# This wrapper restarts it automatically so the Preview Panel stays available.

$ErrorActionPreference = "Stop"
$env:NODE_OPTIONS = "--max-old-space-size=1400"

while ($true) {
    $time = Get-Date -Format "HH:mm:ss"
    Write-Host "[$time] starting next dev (webpack)..."

    # Run the dev server directly so we can track its PID properly
    $proc = Start-Process -FilePath "node" -ArgumentList "node_modules\next\dist\bin\next dev -p 3000 --webpack" -RedirectStandardError "dev.log" -RedirectStandardOutput "dev.log" -PassThru -NoNewWindow
    $proc.WaitForExit()
    
    $exitCode = $proc.ExitCode
    $time = Get-Date -Format "HH:mm:ss"
    Write-Host "[$time] next dev exited (code $exitCode); restarting in 3s..."
    
    Start-Sleep -Seconds 3
    
    # Clean up the dev lock to prevent start failures
    Remove-Item -Path ".next\dev\lock" -Force -ErrorAction SilentlyContinue
    
    Start-Sleep -Seconds 1
}
