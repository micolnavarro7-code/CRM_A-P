# Sirve la web estatica (carpeta out/) en http://localhost:8765 y abre el navegador.
# No necesita Node: usa solo PowerShell, incluido en Windows.
param([switch]$SinNavegador)
$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "out"
$port = 8765
$url = "http://localhost:$port/"

if (-not (Test-Path (Join-Path $root "index.html"))) {
  Write-Host "No existe out\index.html. Genera la web con: npm run build" -ForegroundColor Red
  Read-Host "Pulsa Enter para salir"
  exit 1
}

$mime = @{
  ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"; ".css" = "text/css; charset=utf-8"
  ".json" = "application/json"; ".txt" = "text/plain; charset=utf-8"; ".svg" = "image/svg+xml"; ".png" = "image/png"
  ".jpg" = "image/jpeg"; ".ico" = "image/x-icon"; ".woff2" = "font/woff2"; ".woff" = "font/woff"; ".map" = "application/json"
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($url)
try { $listener.Start() } catch {
  # Probablemente ya esta abierto en otra ventana: solo abrimos el navegador.
  Start-Process $url
  exit 0
}

Write-Host "CRM A&P abierto en $url" -ForegroundColor Green
Write-Host "Deja esta ventana abierta mientras lo usas. Cierrala para apagarlo."
if (-not $SinNavegador) { Start-Process $url }

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart("/")
  $file = Join-Path $root $path
  if ((Test-Path $file -PathType Container)) { $file = Join-Path $file "index.html" }
  elseif (-not (Test-Path $file -PathType Leaf) -and (Test-Path "$file.html" -PathType Leaf)) { $file = "$file.html" }

  $res = $ctx.Response
  # Evita salir de la carpeta out.
  $full = [IO.Path]::GetFullPath($file)
  if ($full.StartsWith([IO.Path]::GetFullPath($root)) -and (Test-Path $full -PathType Leaf)) {
    $res.StatusCode = 200
  } else {
    $full = Join-Path $root "404.html"
    $res.StatusCode = 404
  }
  $ext = [IO.Path]::GetExtension($full).ToLower()
  $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
  try {
    $bytes = [IO.File]::ReadAllBytes($full)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {} finally { $res.Close() }
}
