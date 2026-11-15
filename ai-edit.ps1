param(
    [Parameter(Mandatory=$true)][string]$File,
    [Parameter(Mandatory=$true)][string]$Task,
    [string]$Model = "deepseek-coder-v2:16b"
)

if (-not (Test-Path $File)) {
    Write-Host "File not found: $File" -ForegroundColor Red
    exit 1
}

$code = Get-Content -Path $File -Raw -Encoding utf8
Copy-Item $File "$File.bak" -Force

$prompt = @"
You are a senior TypeScript/React developer. Edit the following file according to the task.
Return ONLY the complete, valid updated file content. Do NOT wrap it in markdown code fences (no ```tsx or ```), and do NOT include explanations.

TASK:
$Task

FILE ($File):
$code
"@

$body = @{
    model  = $Model
    prompt = $prompt
    stream = $false
} | ConvertTo-Json -Depth 5

Write-Host "Sending $File to $Model..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method Post -Body $body -ContentType "application/json; charset=utf-8"
    $updated = $response.response.Trim()

    # Strip accidental markdown fences if the model includes them
    $updated = $updated -replace '^```[a-zA-Z]*\r?\n', ''
    $updated =$updated -replace '\r?\n```$', ''

    [System.IO.File]::WriteAllText((Resolve-Path $File), $updated, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Updated $File successfully! (Backup saved at $File.bak)" -ForegroundColor Green
} catch {
    Write-Host "Error calling Ollama: $_" -ForegroundColor Red
}
