# Serves Screen Translator on http://localhost:8791/ and opens it in your browser.
# Run:  powershell -ExecutionPolicy Bypass -File start.ps1     (Ctrl+C to stop)
param([int]$Port = 8791)
$Root = $PSScriptRoot
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Screen Translator running at http://localhost:$Port/  (Ctrl+C to stop)"
Start-Process "http://localhost:$Port/"
$types = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css'; '.js'='application/javascript' }
try {
  while ($l.IsListening) {
    $ctx = $l.GetContext()
    try {
      $p = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
      if ($p -eq '') { $p = 'index.html' }
      $f = [IO.Path]::GetFullPath((Join-Path $Root $p))
      if ($f.StartsWith($Root) -and (Test-Path $f -PathType Leaf) -and $types[[IO.Path]::GetExtension($f)]) {
        $b = [IO.File]::ReadAllBytes($f)
        $ctx.Response.ContentType = $types[[IO.Path]::GetExtension($f)]
        $ctx.Response.ContentLength64 = $b.Length
        if ($ctx.Request.HttpMethod -ne 'HEAD') { $ctx.Response.OutputStream.Write($b, 0, $b.Length) }
      } else { $ctx.Response.StatusCode = 404 }
    } catch {}
    try { $ctx.Response.Close() } catch {}
  }
} finally { $l.Stop() }
