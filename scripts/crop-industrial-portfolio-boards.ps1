Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$boardRoot = Join-Path $root "public\assets\portfolio\_boards"

$projects = @(
  @{ slug = "jinganbao"; filePrefix = "jinganbao"; targetRoot = "public\assets\jinganbao\v2"; boardA = "jinganbao-v2-board-a.png"; boardB = "jinganbao-v2-board-b.png"; rowsB = 5; rowBoundsB = @(0, 311, 582, 847, 1063, 1254); cmfIndexes = @(8, 9, 10); versionIndexes = @(12, 13, 14); coverIndex = 15 },
  @{ slug = "quiet-air-lighthouse"; filePrefix = "quiet-air-lighthouse-v2"; targetRoot = "public\assets\portfolio\quiet-air-lighthouse-v2"; boardA = "quiet-air-lighthouse-v2-board-a.png"; boardB = "quiet-air-lighthouse-v2-board-b.png"; rowsB = 4; coverIndex = 15 },
  @{ slug = "kitchen-loop-reclaimer"; filePrefix = "kitchen-loop-reclaimer-v2"; targetRoot = "public\assets\portfolio\kitchen-loop-reclaimer-v2"; boardA = "kitchen-loop-reclaimer-v2-board-a.png"; boardB = "kitchen-loop-reclaimer-v2-board-b.png"; rowsB = 4; coverIndex = 11 },
  @{ slug = "granary-fresh-rail"; filePrefix = "granary-fresh-rail-v2"; targetRoot = "public\assets\portfolio\granary-fresh-rail-v2"; boardA = "granary-fresh-rail-board.png"; boardB = "granary-fresh-rail-board-b.png"; rowsB = 4; cmfIndexes = @(12, 13, 14); coverIndex = 6 }
)

function Find-SeparatorRuns([System.Drawing.Bitmap]$bitmap, [bool]$vertical) {
  $limit = if ($vertical) { $bitmap.Width } else { $bitmap.Height }
  $crossLimit = if ($vertical) { $bitmap.Height } else { $bitmap.Width }
  $runs = @()
  $inside = $false
  $start = 0
  for ($coordinate = 0; $coordinate -lt $limit; $coordinate++) {
    $separator = $true
    for ($sample = 16; $sample -lt $crossLimit; $sample += 8) {
      $x = if ($vertical) { $coordinate } else { $sample }
      $y = if ($vertical) { $sample } else { $coordinate }
      $pixel = $bitmap.GetPixel($x, $y)
      if ($pixel.R -lt 240 -or $pixel.G -lt 240 -or $pixel.B -lt 240) {
        $separator = $false
        break
      }
    }
    if ($separator -and -not $inside) {
      $start = $coordinate
      $inside = $true
    }
    if ((-not $separator -or $coordinate -eq $limit - 1) -and $inside) {
      $end = if ($separator) { $coordinate } else { $coordinate - 1 }
      if ($end - $start + 1 -ge 4) {
        $runs += @{ start = $start; end = $end }
      }
      $inside = $false
    }
  }
  return $runs
}

function Get-Cells([System.Drawing.Bitmap]$bitmap, [int]$rows = 4, [int[]]$rowBounds = $null) {
  # Generated boards are deliberately composed as a 4x4 contact sheet. Use
  # fixed quadrants with a generous inset so white gutters can never leak into
  # an exported product image, even when a cell itself has a pale background.
  $inset = 14
  $cells = @()
  for ($row = 0; $row -lt $rows; $row++) {
    for ($column = 0; $column -lt 4; $column++) {
      $left = [math]::Max(0, [math]::Floor($column * $bitmap.Width / 4) + $inset)
      $right = [math]::Min($bitmap.Width - 1, [math]::Ceiling(($column + 1) * $bitmap.Width / 4) - $inset - 1)
      if ($rowBounds -and $rowBounds.Count -eq ($rows + 1)) {
        $top = [math]::Max(0, $rowBounds[$row] + 6)
        $bottom = [math]::Min($bitmap.Height - 1, $rowBounds[$row + 1] - 7)
      } else {
        $top = [math]::Max(0, [math]::Floor($row * $bitmap.Height / $rows) + $inset)
        $bottom = [math]::Min($bitmap.Height - 1, [math]::Ceiling(($row + 1) * $bitmap.Height / $rows) - $inset - 1)
      }
      $cells += @{ left = $left; top = $top; width = $right - $left + 1; height = $bottom - $top + 1 }
    }
  }
  return $cells
}

function Save-Crop([System.Drawing.Bitmap]$source, [hashtable]$cell, [string]$target) {
  $trim = 1
  $cropWidth = $cell.width - ($trim * 2)
  $cropHeight = $cell.height - ($trim * 2)
  $crop = [System.Drawing.Bitmap]::new($cropWidth, $cropHeight)
  $graphics = [System.Drawing.Graphics]::FromImage($crop)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $sourceLeft = ([int]$cell.left) + $trim
  $sourceTop = ([int]$cell.top) + $trim
  $destinationRectangle = [System.Drawing.Rectangle]::new(0, 0, $cropWidth, $cropHeight)
  $sourceRectangle = [System.Drawing.Rectangle]::new($sourceLeft, $sourceTop, $cropWidth, $cropHeight)
  $graphics.DrawImage($source, $destinationRectangle, $sourceRectangle, [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.Dispose()
  $crop.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose()
}

foreach ($project in $projects) {
  $boardPathA = Join-Path $boardRoot $project.boardA
  $boardPathB = Join-Path $boardRoot $project.boardB
  $sourceA = [System.Drawing.Bitmap]::new($boardPathA)
  $sourceB = [System.Drawing.Bitmap]::new($boardPathB)
  try {
    $cellsA = Get-Cells $sourceA
    $cellsB = Get-Cells $sourceB ([int]$project.rowsB) $project.rowBoundsB
    $targetRoot = Join-Path $root $project.targetRoot
    New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null
    $names = @(
      "evidence-01", "evidence-02", "evidence-03", "evidence-04", "evidence-05",
      "insight-01", "insight-02", "insight-03", "insight-04", "insight-05",
      "direction-01", "direction-02", "direction-03",
      "concept-01", "concept-02", "concept-03"
    )
    for ($index = 0; $index -lt $names.Count; $index++) {
      $filePrefix = if ($project.filePrefix) { $project.filePrefix } else { $project.slug }
      Save-Crop $sourceA $cellsA[$index] (Join-Path $targetRoot "$filePrefix-$($names[$index]).png")
    }
    # The second board is intentionally used for the less frequent workflow
    # roles, so every URL points to a different generated source cell.
    $namesB = @(
      "concept-04", "concept-05", "concept-06", "concept-07", "concept-08", "concept-09",
      "cmf-01", "cmf-02", "cmf-03",
      "version-01", "version-02", "version-03", "cover-01"
    )
    for ($index = 0; $index -lt $namesB.Count; $index++) {
      $sourceIndex = $index
      if ($project.cmfIndexes -and $index -ge 6 -and $index -le 8) { $sourceIndex = $project.cmfIndexes[$index - 6] }
      if ($project.versionIndexes -and $index -ge 9 -and $index -le 11) { $sourceIndex = $project.versionIndexes[$index - 9] }
      if ($project.coverIndex -ne $null -and $index -eq 12) { $sourceIndex = $project.coverIndex }
      $filePrefix = if ($project.filePrefix) { $project.filePrefix } else { $project.slug }
      Save-Crop $sourceB $cellsB[$sourceIndex] (Join-Path $targetRoot "$filePrefix-$($namesB[$index]).png")
    }
    Write-Output "Cropped $($project.slug): $($names.Count + $namesB.Count) PNG assets"
  } finally {
    $sourceA.Dispose()
    $sourceB.Dispose()
  }
}
