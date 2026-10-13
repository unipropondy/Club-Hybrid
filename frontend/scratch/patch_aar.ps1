$aarPath = 'C:\Users\User\.gradle\caches\modules-2\files-2.1\com.facebook.react\react-android\0.86.3\811474b9e24f783511aebb0863c63cb9cb8edb3b\react-android-0.86.3-debug.aar'

Write-Host "Checking AAR: $aarPath"
if (!(Test-Path $aarPath)) {
    Write-Error "AAR file not found!"
    exit 1
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# 1. Update AAR
$zip = [System.IO.Compression.ZipFile]::Open($aarPath, [System.IO.Compression.ZipArchiveMode]::Update)
$entry = $zip.GetEntry('prefab/modules/reactnative/include/react/renderer/core/graphicsConversions.h')
if ($entry) {
    $reader = New-Object System.IO.StreamReader($entry.Open())
    $content = $reader.ReadToEnd()
    $reader.Close()

    if ($content.Contains('std::format("{}%", dimension.value)')) {
        $newContent = $content.Replace('std::format("{}%", dimension.value)', '(std::to_string(dimension.value) + "%")')
        $entry.Delete()
        $newEntry = $zip.CreateEntry('prefab/modules/reactnative/include/react/renderer/core/graphicsConversions.h')
        $writer = New-Object System.IO.StreamWriter($newEntry.Open())
        $writer.Write($newContent)
        $writer.Close()
        Write-Host "Successfully patched graphicsConversions.h inside react-android-0.86.3-debug.aar!"
    } else {
        Write-Host "graphicsConversions.h inside AAR is already patched."
    }
} else {
    Write-Warning "Entry prefab/.../graphicsConversions.h not found in AAR!"
}
$zip.Dispose()

# 2. Clean corrupted/modified transforms cache
$transformsDir = 'C:\Users\User\.gradle\caches\9.3.1\transforms'
if (Test-Path $transformsDir) {
    Get-ChildItem -Path $transformsDir -Directory | ForEach-Object {
        $ws = Join-Path $_.FullName 'workspace\transformed\react-android-0.86.3-debug'
        if (Test-Path $ws) {
            Write-Host "Deleting cached transform: $($_.FullName)"
            Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "Patch complete and transforms cache cleaned."
