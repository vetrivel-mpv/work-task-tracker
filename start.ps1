# Northstar Delivery — local static file server.
# No installs, no internet access needed: this only uses .NET classes that
# ship with Windows/PowerShell already. Serves this folder over
# http://localhost, since the app's ES modules won't load over file://.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$port = 8000
$prefix = "http://localhost:$port/"

$mimeTypes = @{
  '.html'  = 'text/html; charset=utf-8'
  '.htm'   = 'text/html; charset=utf-8'
  '.js'    = 'text/javascript; charset=utf-8'
  '.mjs'   = 'text/javascript; charset=utf-8'
  '.css'   = 'text/css; charset=utf-8'
  '.json'  = 'application/json; charset=utf-8'
  '.txt'   = 'text/plain; charset=utf-8'
  '.svg'   = 'image/svg+xml'
  '.png'   = 'image/png'
  '.jpg'   = 'image/jpeg'
  '.jpeg'  = 'image/jpeg'
  '.gif'   = 'image/gif'
  '.ico'   = 'image/x-icon'
  '.woff'  = 'font/woff'
  '.woff2' = 'font/woff2'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Host "Couldn't start the server on port $port." -ForegroundColor Red
  Write-Host $_.Exception.Message
  Write-Host "`nIf that says the port is in use, close whatever else is using it, or edit start.ps1 and change `$port to something else (e.g. 8080)." -ForegroundColor Yellow
  Read-Host "`nPress Enter to exit"
  exit 1
}

Write-Host "Northstar Delivery is running at $prefix" -ForegroundColor Green
Write-Host "Leave this window open while you use the app." -ForegroundColor Yellow
Write-Host "Press Ctrl+C here (or just close this window) to stop it.`n" -ForegroundColor Yellow

Start-Process $prefix

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $localPath = $request.Url.LocalPath
    if ($localPath -eq '/') { $localPath = '/index.html' }
    $relative = $localPath.TrimStart('/') -replace '/', '\'
    $filePath = Join-Path $root $relative

    # Keep requests inside this folder (no ../.. escapes).
    $fullFilePath = [System.IO.Path]::GetFullPath($filePath)
    $fullRoot = [System.IO.Path]::GetFullPath($root)
    $fullRootWithSep = if ($fullRoot.EndsWith('\')) { $fullRoot } else { "$fullRoot\" }

    if (($fullFilePath -eq $fullRoot -or $fullFilePath.StartsWith($fullRootWithSep)) -and (Test-Path $fullFilePath -PathType Leaf)) {
      $ext = [System.IO.Path]::GetExtension($fullFilePath).ToLower()
      $contentType = $mimeTypes[$ext]
      if (-not $contentType) { $contentType = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($fullFilePath)
      $response.ContentType = $contentType
      $response.ContentLength64 = $bytes.Length
      # Without this, the browser can silently keep serving an old cached
      # copy of a .js/.css file after you edit it and reload.
      $response.Headers.Add('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $response.StatusCode = 404
      $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 - Not Found: $localPath")
      $response.OutputStream.Write($notFound, 0, $notFound.Length)
    }
    $response.OutputStream.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
