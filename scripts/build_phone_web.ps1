Param(
  [string]$PhoneAppPath = "C:\Users\j_tagami\CiquestWebApp\phone_app",
  [string]$OutDir = "C:\Users\j_tagami\CiquestWebApp\ciquest_phone"
)

if (-Not (Test-Path $PhoneAppPath)) {
  Write-Error "Phone app path not found: $PhoneAppPath"
  exit 1
}

Push-Location $PhoneAppPath
try {
  if (-Not (Test-Path "node_modules")) {
    npm install
  }

  if (-Not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" ".env"
  }

  npx expo export --platform web --output-dir $OutDir
} finally {
  Pop-Location
}
