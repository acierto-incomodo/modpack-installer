@echo off
setlocal

set "vbs=%temp%\storm_uninstall_msg.vbs"

> "%vbs%" echo MsgBox "Este programa no se puede desinstalar desde StormStore ni variantes de productos de StormGamesStudios." ^& vbCrLf ^& vbCrLf ^& "Utilice el menu Inicio de Windows, Microsoft Store o Ajustes/Configuracion para desinstalarlo.", 64, "StormGamesStudios"

wscript "%vbs%"
del "%vbs%"

exit