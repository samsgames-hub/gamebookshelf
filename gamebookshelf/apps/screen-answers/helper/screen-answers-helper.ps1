# Screen Answers helper
# Lets the Screen Answers web app use your Claude Pro/Max plan through Claude Code on this computer.
# It listens on http://localhost:8787 and only accepts requests from the Screen Answers page.
#
# Run it with:
#   powershell -ExecutionPolicy Bypass -File screen-answers-helper.ps1
# Leave the window open while you use the app. Close it (or press Ctrl+C) to stop.

$ErrorActionPreference = 'Stop'
$Port = 8787
$AllowedOrigins = @('https://gamebookshelf.com', 'https://www.gamebookshelf.com')
$AllowedLocal = '^https?://(localhost|127\.0\.0\.1)(:\d+)?$'
$ModelAliases = @{ 'claude-opus-5-5' = 'opus'; 'claude-sonnet-5-5' = 'sonnet'; 'claude-haiku-5-5' = 'haiku' }
$TimeoutSec = 180

function Find-Claude {
  if ($env:SCREEN_ANSWERS_CLAUDE -and (Test-Path $env:SCREEN_ANSWERS_CLAUDE)) { return $env:SCREEN_ANSWERS_CLAUDE }
  $cmd = Get-Command claude -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @("$env:USERPROFILE\.local\bin\claude.exe", "$env:APPDATA\npm\claude.cmd")) { if (Test-Path $p) { return $p } }
  return $null
}

$Claude = Find-Claude
Write-Host ''
Write-Host '  Screen Answers helper' -ForegroundColor Yellow
if ($Claude) {
  Write-Host "  Using Claude Code at $Claude"
} else {
  Write-Host '  Claude Code is not installed yet. Install it with this command in PowerShell:' -ForegroundColor Red
  Write-Host '    irm https://claude.ai/install.ps1 | iex'
  Write-Host '  then run "claude" once and sign in with your Claude account, and start this helper again.'
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch {
  Write-Host "  Could not listen on port $Port. Is the helper already running in another window?" -ForegroundColor Red
  exit 1
}
Write-Host "  Listening on http://localhost:$Port - keep this window open while you use Screen Answers."
Write-Host ''

function Send-Json($ctx, [int]$code, $obj) {
  $bytes = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress -Depth 5))
  $ctx.Response.StatusCode = $code
  $ctx.Response.ContentType = 'application/json; charset=utf-8'
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.Close()
}

function Invoke-Claude($req) {
  $work = Join-Path ([IO.Path]::GetTempPath()) ('screen-answers-' + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $work | Out-Null
  try {
    $prompt = [Text.StringBuilder]::new()
    [void]$prompt.AppendLine([string]$req.system)
    [void]$prompt.AppendLine()
    if ($req.image) {
      $bytes = [Convert]::FromBase64String([string]$req.image)
      if ($bytes.Length -gt 8MB) { throw 'The screenshot is too large.' }
      [IO.File]::WriteAllBytes((Join-Path $work 'screenshot.jpg'), $bytes)
      [void]$prompt.AppendLine('The screenshot is the file screenshot.jpg in the current folder. Read it with the Read tool, then answer. Do not use any other tool and do not mention the file.')
    }
    if ($req.context) {
      [void]$prompt.AppendLine()
      [void]$prompt.AppendLine('Earlier in this conversation you answered:')
      [void]$prompt.AppendLine([string]$req.context)
    }
    [void]$prompt.AppendLine()
    [void]$prompt.AppendLine([string]$req.text)

    $model = $ModelAliases[[string]$req.model]; if (-not $model) { $model = 'opus' }
    $psi = [Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $Claude
    $psi.Arguments = "-p --output-format text --model $model --max-turns 4 --allowedTools Read --disallowedTools Bash Edit Write WebFetch WebSearch"
    $psi.WorkingDirectory = $work
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = [Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [Text.Encoding]::UTF8
    $psi.CreateNoWindow = $true
    # Make Claude Code use your signed-in Claude plan, not an API key from the environment.
    foreach ($v in 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN') { if ($psi.EnvironmentVariables.ContainsKey($v)) { $psi.EnvironmentVariables.Remove($v) } }

    $p = [Diagnostics.Process]::Start($psi)
    $outTask = $p.StandardOutput.ReadToEndAsync()
    $errTask = $p.StandardError.ReadToEndAsync()
    $stdin = [IO.StreamWriter]::new($p.StandardInput.BaseStream, [Text.UTF8Encoding]::new($false))
    $stdin.Write($prompt.ToString())
    $stdin.Close()
    if (-not $p.WaitForExit($TimeoutSec * 1000)) {
      try { $p.Kill() } catch { }
      throw "Claude Code took longer than $TimeoutSec seconds."
    }
    $out = $outTask.Result.Trim()
    $err = $errTask.Result.Trim()
    if ($p.ExitCode -ne 0 -or -not $out) {
      $msg = if ($err) { $err } elseif ($out) { $out } else { "Claude Code exited with code $($p.ExitCode)." }
      throw $msg
    }
    return $out
  } finally {
    Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
  }
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $origin = $ctx.Request.Headers['Origin']
  $okOrigin = $origin -and (($AllowedOrigins -contains $origin) -or ($origin -match $AllowedLocal))
  if ($okOrigin) {
    $ctx.Response.Headers['Access-Control-Allow-Origin'] = $origin
    $ctx.Response.Headers['Vary'] = 'Origin'
  }
  try {
    if (-not $okOrigin) { Send-Json $ctx 403 @{ error = 'Only the Screen Answers page can use this helper.' }; continue }
    if ($ctx.Request.HttpMethod -eq 'OPTIONS') {
      $ctx.Response.Headers['Access-Control-Allow-Methods'] = 'GET, POST'
      $ctx.Response.Headers['Access-Control-Allow-Headers'] = 'Content-Type'
      $ctx.Response.Headers['Access-Control-Allow-Private-Network'] = 'true'
      $ctx.Response.StatusCode = 204
      $ctx.Response.Close()
      continue
    }
    $path = $ctx.Request.Url.AbsolutePath
    if ($path -eq '/health') {
      if (-not $Claude) { $Claude = Find-Claude }
      Send-Json $ctx 200 @{ ok = $true; claude = [bool]$Claude; version = 1 }
    } elseif ($path -eq '/ask' -and $ctx.Request.HttpMethod -eq 'POST') {
      if (-not $Claude) { $Claude = Find-Claude }
      if (-not $Claude) { Send-Json $ctx 503 @{ error = 'Claude Code is not installed. Install it with: irm https://claude.ai/install.ps1 | iex - then run "claude" once to sign in.' }; continue }
      $reader = [IO.StreamReader]::new($ctx.Request.InputStream, [Text.Encoding]::UTF8)
      $req = $reader.ReadToEnd() | ConvertFrom-Json
      $reader.Close()
      $t = Get-Date
      Write-Host ("  {0:HH:mm:ss}  asking Claude ({1})..." -f $t, $req.model)
      try {
        $text = Invoke-Claude $req
        Write-Host ("  {0:HH:mm:ss}  answered in {1:N1}s" -f (Get-Date), ((Get-Date) - $t).TotalSeconds) -ForegroundColor Green
        Send-Json $ctx 200 @{ text = $text }
      } catch {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        Send-Json $ctx 500 @{ error = $_.Exception.Message }
      }
    } else {
      Send-Json $ctx 404 @{ error = 'Not found' }
    }
  } catch {
    try { $ctx.Response.Abort() } catch { }
  }
}
