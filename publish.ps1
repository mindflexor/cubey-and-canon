# Cubey & Canon: upload original game ZIP to GitHub Pages.
# Run from Windows PowerShell:
#   $p = "$env:TEMP\cubey-publish.ps1"
#   Invoke-WebRequest "https://raw.githubusercontent.com/mindflexor/cubey-and-canon/main/publish.ps1" -OutFile $p
#   powershell -ExecutionPolicy Bypass -File $p
param([string]$SourcePath = "$HOME\Downloads\Cubey & Canon.zip")

$ErrorActionPreference = "Stop"
$repoURL = "https://github.com/mindflexor/cubey-and-canon.git"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not installed. Install Git for Windows from https://git-scm.com/downloads/win."
}
if (-not (Test-Path -LiteralPath $SourcePath)) {
  Write-Host "Original game ZIP not found at: $SourcePath" -ForegroundColor Yellow
  $SourcePath = (Read-Host "Enter full path to Cubey & Canon.zip (or the game project folder)").Trim('"')
}
if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "Game source not found: $SourcePath"
}

$work = Join-Path $env:TEMP ("cubey-github-" + [guid]::NewGuid().ToString("N"))
$checkout = Join-Path $work "repo"
$unzip = Join-Path $work "unzipped"
New-Item -ItemType Directory -Force -Path $work | Out-Null

if (Test-Path -LiteralPath $SourcePath -PathType Leaf) {
  New-Item -ItemType Directory -Force -Path $unzip | Out-Null
  Write-Host "Extracting original game ZIP..." -ForegroundColor Cyan
  Expand-Archive -LiteralPath $SourcePath -DestinationPath $unzip -Force
  $project = Join-Path $unzip "Cubey & Canon"
  if (-not (Test-Path -LiteralPath (Join-Path $project "package.json"))) {
    $project = $unzip
  }
} else {
  $project = $SourcePath
}

foreach ($item in @("index.html", "package.json", "package-lock.json", "src", "public")) {
  if (-not (Test-Path -LiteralPath (Join-Path $project $item))) {
    throw "Cannot find $item in the game project folder: $project"
  }
}
Write-Host "Game files confirmed. Cloning your GitHub repository..." -ForegroundColor Cyan
& git clone $repoURL $checkout
if ($LASTEXITCODE -ne 0) { throw "Git clone failed." }

foreach ($item in @("index.html", "package.json", "package-lock.json", "src", "public")) {
  Copy-Item -LiteralPath (Join-Path $project $item) -Destination (Join-Path $checkout $item) -Recurse -Force
}
Write-Host "Files copied, including audio and textures." -ForegroundColor Green
& git -C $checkout add index.html package.json package-lock.json src public
if ($LASTEXITCODE -ne 0) { throw "Could not stage game files." }
& git -C $checkout diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
  & git -C $checkout commit -m "Upload complete Cubey and Canon game for GitHub Pages"
  if ($LASTEXITCODE -ne 0) { throw "Git commit failed. Check git config user.name and user.email." }
  & git -C $checkout push origin HEAD:main
  if ($LASTEXITCODE -ne 0) { throw "Git push failed. Check your GitHub authentication." }
} elseif ($LASTEXITCODE -ne 0) {
  throw "Git diff failed."
} else {
  Write-Host "Game files are already committed." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Upload complete!" -ForegroundColor Green
Write-Host "NEXT: https://github.com/mindflexor/cubey-and-canon/settings/pages" -ForegroundColor Yellow
Write-Host "Set Build and deployment > Source to GitHub Actions." -ForegroundColor Yellow
Write-Host "Check build: https://github.com/mindflexor/cubey-and-canon/actions" -ForegroundColor Cyan
Write-Host "Play: https://mindflexor.github.io/cubey-and-canon/" -ForegroundColor Green
