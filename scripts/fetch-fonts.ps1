param()

# Downloads Noto Sans Thai TTF files into public/fonts/
# Run from project root (PowerShell):
#   .\scripts\fetch-fonts.ps1

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $projectRoot) { $projectRoot = Get-Location }

$fontsDir = Join-Path $projectRoot 'public' | Join-Path -ChildPath 'fonts'
Write-Host "Fonts directory: $fontsDir"

New-Item -ItemType Directory -Path $fontsDir -Force | Out-Null

$files = @{
  'NotoSansThai-Regular.ttf' = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansThai/NotoSansThai-Regular.ttf'
  'NotoSansThai-Bold.ttf'    = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansThai/NotoSansThai-Bold.ttf'
}

# Optional monospace font for tokens/QR labels
$files['RobotoMono-Regular.ttf'] = 'https://raw.githubusercontent.com/google/fonts/main/apache/robotomono/RobotoMono-Regular.ttf'
# Fallback monospace if Roboto Mono cannot be downloaded
$files['NotoSansMono-Regular.ttf'] = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansMono/NotoSansMono-Regular.ttf'

$errors = @()
foreach ($name in $files.Keys) {
  $url = $files[$name]
  $outPath = Join-Path $fontsDir $name
  $downloaded = $false
  for ($attempt=1; $attempt -le 3; $attempt++) {
    try {
      Write-Host "Downloading $name... (attempt $attempt)"
      Invoke-WebRequest -Uri $url -OutFile $outPath -UseBasicParsing -ErrorAction Stop
      $size = (Get-Item $outPath).Length
      if ($size -gt 0) {
        Write-Host "Saved $name ($([math]::Round($size/1024,2)) KB)"
        $downloaded = $true
        break
      } else {
        Remove-Item -Path $outPath -ErrorAction SilentlyContinue
        Write-Warning "Downloaded file is empty, will retry."
      }
    } catch {
      Write-Warning "Attempt $attempt failed for ${name}: $($_.Exception.Message)"
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
  if (-not $downloaded) {
    Write-Error ("Failed to download {0} after 3 attempts" -f $name)
    $errors += $name
  }
}

if ($errors.Count -gt 0) {
  Write-Error "Some fonts failed to download: $($errors -join ', ')"
  exit 1
}

Write-Host "Fonts downloaded to $fontsDir. Restart Next.js server if running."
exit 0
