# Upload Cubey & Canon from its original ZIP to github.com/mindflexor/cubey-and-canon.
# The ZIP can be named Cubey & Canon(1).zip or Cubey & Canon.zip and can live on any Windows drive.
param([string]$SourcePath = "")

$ErrorActionPreference = "Stop"
$repoURL = "https://github.com/mindflexor/cubey-and-canon.git"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git for Windows is not installed. Install it from https://git-scm.com/downloads/win and run this again."
}

if (-not $SourcePath) {
  $candidates = @(
    (Join-Path $HOME "Downloads\Cubey & Canon(1).zip"),
    (Join-Path $HOME "Downloads\Cubey & Canon.zip"),
    (Join-Path $HOME "Desktop\Cubey & Canon(1).zip"),
    (Join-Path $HOME "Desktop\Cubey & Canon.zip"),
    (Join-Path $HOME "Documents\Cubey & Canon(1).zip"),
    (Join-Path $HOME "Documents\Cubey & Canon.zip")
  )
  foreach ($drive in (Get-PSDrive -PSProvider FileSystem)) {
    foreach ($filename in @("Cubey & Canon(1).zip", "Cubey & Canon.zip")) {
      $candidates += Join-Path $drive.Root $filename
    }
  }
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      $SourcePath = $candidate
      break
    }
  }
}
if (-not $SourcePath) {
  Write-Host "Select your Cubey & Canon ZIP from any drive." -ForegroundColor Cyan
  try {
    Add-Type -AssemblyName System.Windows.Forms
    $picker = New-Object System.Windows.Forms.OpenFileDialog
    $picker.Title = "Select Cubey & Canon(1).zip"
    $picker.Filter = "ZIP files (*.zip)|*.zip|All files (*.*)|*.*"
    $picker.InitialDirectory = [Environment]::GetFolderPath("UserProfile")
    if ($picker.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
      $SourcePath = $picker.FileName
    }
  } catch {
    Write-Host "File picker unavailable: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}
if (-not $SourcePath) {
  $SourcePath = (Read-Host "Paste the full path to Cubey & Canon(1).zip").Trim().Trim('"')
}
if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "Could not find ZIP at: $SourcePath. Save the ZIP to this PC or pass -SourcePath with the correct path."
}
Write-Host "Using: $SourcePath" -ForegroundColor Green

$work = Join-Path $env:TEMP ("cubey-github-" + [guid]::NewGuid().ToString("N"))
$checkout = Join-Path $work "repo"
$unzip = Join-Path $work "unzipped"
New-Item -ItemType Directory -Force -Path $work | Out-Null

if (Test-Path -LiteralPath $SourcePath -PathType Leaf) {
  New-Item -ItemType Directory -Force -Path $unzip | Out-Null
  Write-Host "Extracting game..." -ForegroundColor Cyan
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
    throw "Missing $item inside game folder $project. Select the original complete game ZIP."
  }
}

Write-Host "Cloning your GitHub repository..." -ForegroundColor Cyan
& git clone $repoURL $checkout
if ($LASTEXITCODE -ne 0) { throw "Git clone failed." }
foreach ($item in @("index.html", "package.json", "package-lock.json", "src", "public")) {
  Copy-Item -LiteralPath (Join-Path $project $item) -Destination (Join-Path $checkout $item) -Recurse -Force
}
& git -C $checkout add index.html package.json package-lock.json src public
if ($LASTEXITCODE -ne 0) { throw "Git staging failed." }

& git -C $checkout diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
  & git -C $checkout commit -m "Add complete Cubey and Canon game for GitHub Pages"
  if ($LASTEXITCODE -ne 0) { throw "Git commit failed. Configure git user.name and user.email if requested." }
  & git -C $checkout push origin HEAD:main
  if ($LASTEXITCODE -ne 0) { throw "Git push failed. Confirm your GitHub sign-in." }
} elseif ($LASTEXITCODE -ne 0) {
  throw "Git diff failed."
} else {
  Write-Host "Game files already uploaded." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "The game source and assets have been pushed!" -ForegroundColor Green
Write-Host "Enable GitHub Actions in Pages settings, if not already enabled:" -ForegroundColor Yellow
Write-Host "https://github.com/mindflexor/cubey-and-canon/settings/pages" -ForegroundColor Cyan
Write-Host "Check build: https://github.com/mindflexor/cubey-and-canon/actions" -ForegroundColor Cyan
Write-Host "Play: https://mindflexor.github.io/cubey-and-canon/" -ForegroundColor Green
