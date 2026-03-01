Clear-Host

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   🚀 INICIANDO PROCESO DE BUILD 🚀" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Paso 1: Limpiar directorios anteriores
Write-Host "`n[PASO 1/4] 🧹 Limpiando directorios 'dist' y 'subir'..." -ForegroundColor Yellow
if (Test-Path -Path "dist") {
    Remove-Item -Path "dist\*" -Recurse -Force
    Write-Host "   ✅ Directorio 'dist' limpiado con éxito." -ForegroundColor Green
} else {
    Write-Host "   ℹ️ El directorio 'dist' no existe, no se necesita limpieza." -ForegroundColor Gray
}
if (Test-Path -Path "subir") {
    Remove-Item -Path "subir" -Recurse -Force
    Write-Host "   ✅ Directorio 'subir' limpiado con éxito." -ForegroundColor Green
} else {
    Write-Host "   ℹ️ El directorio 'subir' no existe, no se necesita limpieza." -ForegroundColor Gray
}

# Paso 2: Instalar dependencias
Write-Host "`n[PASO 2/4] 📦 Instalando dependencias (npm install)..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Error al instalar las dependencias. Abortando." -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Dependencias instaladas correctamente." -ForegroundColor Green

# Paso 3: Ejecutar el build
Write-Host "`n[PASO 3/4] 🛠️ Compilando la aplicación (npm run build)..." -ForegroundColor Yellow
npm run build

# Paso 4: Organizar archivos para subir
Write-Host "`n[PASO 4/4] 📂 Organizando archivos en carpeta 'subir'..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "subir" | Out-Null

# Copiar archivos de dist (.exe, .blockmap, .yml)
Get-ChildItem -Path "dist" | Where-Object { $_.Extension -in ".exe", ".blockmap", ".yml" } | Copy-Item -Destination "subir"
Write-Host "   ✅ Archivos de instalación copiados." -ForegroundColor Green

# Copiar contenido de instances
if (Test-Path "instances") {
    Copy-Item -Path "instances\*" -Destination "subir" -Recurse
    Write-Host "   ✅ Archivos de 'instances' copiados." -ForegroundColor Green
}

# Copiar contenido de instance-versions
if (Test-Path "instance-versions") {
    Copy-Item -Path "instance-versions\*" -Destination "subir" -Recurse
    Write-Host "   ✅ Archivos de 'instance-versions' copiados." -ForegroundColor Green
}

# Copiar contenido de instance-versions
if (Test-Path "instances-big") {
    Copy-Item -Path "instances-big\*" -Destination "subir" -Recurse
    Write-Host "   ✅ Archivos de 'instances-big' copiados." -ForegroundColor Green
}

Write-Host "`n🎉 ¡Proceso completado! Los archivos listos para subir están en la carpeta 'subir'. 🎉" -ForegroundColor Magenta