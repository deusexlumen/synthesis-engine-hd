#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Download Swiss Ephemeris files for professional accuracy

.DESCRIPTION
    Downloads .se1 ephemeris files from the Swiss Ephemeris GitHub repository.
    These files provide NASA JPL-level accuracy (±0.0001°) for astronomical calculations.

.PARAMETER TargetPath
    Directory where the ephemeris files should be downloaded
    Default: "..\app\src-tauri\ephemeris"

.PARAMETER TimeRange
    Which ephemeris time range to download
    - "1800-2400" (default, ~1.2 MB) - sufficient for Human Design charts
    - "3000" (~9 MB) - 3000 BCE to 3000 CE
    - "all" (~115 MB) - 13201 BCE to 17191 CE

.EXAMPLE
    .\download-ephemeris.ps1
    Downloads standard ephemeris files to the default location

.EXAMPLE
    .\download-ephemeris.ps1 -TimeRange "3000"
    Downloads extended range ephemeris files

.NOTES
    File Information:
    - sepl_*.se1: Planetary positions (Sun, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto)
    - semo_*.se1: Lunar positions
    - seas_*.se1: Asteroid positions
    
    Source: https://github.com/aloistr/swisseph/tree/master/ephe
    License: Dual license (AGPL-3.0 or Professional License)
#>

param(
    [string]$TargetPath = "..\app\src-tauri\ephemeris",
    [ValidateSet("1800-2400", "3000", "all")]
    [string]$TimeRange = "1800-2400"
)

# GitHub Raw URL base
$BaseUrl = "https://raw.githubusercontent.com/aloistr/swisseph/master/ephe"

# File mappings based on time range
$Files = switch ($TimeRange) {
    "1800-2400" {
        @(
            @{ Name = "sepl_18.se1"; Description = "Planets (1800-2400 CE)"; Size = "~400 KB" },
            @{ Name = "semo_18.se1"; Description = "Moon (1800-2400 CE)"; Size = "~800 KB" },
            @{ Name = "seas_18.se1"; Description = "Asteroids (1800-2400 CE)"; Size = "~200 KB" }
        )
    }
    "3000" {
        @(
            @{ Name = "seplm18.se1"; Description = "Planets (3000 BCE - 3000 CE)"; Size = "~3 MB" },
            @{ Name = "semom18.se1"; Description = "Moon (3000 BCE - 3000 CE)"; Size = "~6 MB" },
            @{ Name = "seasm18.se1"; Description = "Asteroids (3000 BCE - 3000 CE)"; Size = "~2 MB" }
        )
    }
    "all" {
        @(
            @{ Name = "sepl_18.se1"; Description = "Planets (1800-2400 CE)"; Size = "~400 KB" },
            @{ Name = "semo_18.se1"; Description = "Moon (1800-2400 CE)"; Size = "~800 KB" },
            @{ Name = "seplm18.se1"; Description = "Planets (3000 BCE - 3000 CE)"; Size = "~3 MB" },
            @{ Name = "semom18.se1"; Description = "Moon (3000 BCE - 3000 CE)"; Size = "~6 MB" },
            @{ Name = "seplm54.se1"; Description = "Planets (13201 BCE - 17191 CE)"; Size = "~36 MB" },
            @{ Name = "sefstars.txt"; Description = "Fixed stars"; Size = "~300 KB" }
        )
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Swiss Ephemeris Downloader" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target: $TargetPath" -ForegroundColor Yellow
Write-Host "Range:  $TimeRange" -ForegroundColor Yellow
Write-Host ""

# Create directory if it doesn't exist
if (!(Test-Path -Path $TargetPath)) {
    Write-Host "Creating directory: $TargetPath" -ForegroundColor Gray
    New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null
}

$SuccessCount = 0
$FailCount = 0

foreach ($File in $Files) {
    $Url = "$BaseUrl/$($File.Name)"
    $OutputPath = Join-Path $TargetPath $File.Name
    
    Write-Host "Downloading: $($File.Name)" -NoNewline
    Write-Host " ($($File.Description), $($File.Size))" -ForegroundColor Gray
    
    try {
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $Url -OutFile $OutputPath -ErrorAction Stop
        
        $FileSize = (Get-Item $OutputPath).Length
        $FileSizeKB = [math]::Round($FileSize / 1KB, 2)
        
        Write-Host "  ✓ Success ($FileSize KB)" -ForegroundColor Green
        $SuccessCount++
    }
    catch {
        Write-Host "  ✗ Failed: $_" -ForegroundColor Red
        $FailCount++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Download Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Successful: $SuccessCount" -ForegroundColor Green
Write-Host "Failed:     $FailCount" -ForegroundColor $(if ($FailCount -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($SuccessCount -gt 0) {
    Write-Host "Ephemeris files installed to:" -ForegroundColor Yellow
    Write-Host "  $((Resolve-Path $TargetPath).Path)" -ForegroundColor White
    Write-Host ""
    Write-Host "You can now use professional accuracy (±0.0001°) in your calculations!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To verify, run: cargo test in the src-tauri directory" -ForegroundColor Gray
}

if ($FailCount -gt 0) {
    Write-Host "Some downloads failed. You can:" -ForegroundColor Yellow
    Write-Host "  1. Check your internet connection" -ForegroundColor Gray
    Write-Host "  2. Try downloading manually from:" -ForegroundColor Gray
    Write-Host "     https://github.com/aloistr/swisseph/tree/master/ephe" -ForegroundColor Cyan
    Write-Host "  3. The code will fall back to Moshier formulas (±0.1° accuracy)" -ForegroundColor Gray
    exit 1
}

exit 0
