Clear-Host

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   🚀 INICIANDO PROCESO DE BUILD 🚀" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Paso 1: Limpiar el directorio 'dist'
Write-Host "`n[PASO 1/3] 🧹 Limpiando directorio de compilación anterior..." -ForegroundColor Yellow
if (Test-Path -Path "dist") {
    Remove-Item -Path "dist\*" -Recurse -Force
    Write-Host "   ✅ Directorio 'dist' limpiado con éxito." -ForegroundColor Green
} else {
    Write-Host "   ℹ️ El directorio 'dist' no existe, no se necesita limpieza." -ForegroundColor Gray
}

# Paso 2: Instalar dependencias
Write-Host "`n[PASO 2/3] 📦 Instalando dependencias (npm install)..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Error al instalar las dependencias. Abortando." -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Dependencias instaladas correctamente." -ForegroundColor Green

# Paso 3: Ejecutar el build
Write-Host "`n[PASO 3/3] 🛠️ Compilando la aplicación (npm run build)..." -ForegroundColor Yellow
npm run build

Write-Host "`n🎉 ¡Compilación completada! Tu instalador está en la carpeta 'dist'. 🎉" -ForegroundColor Magenta