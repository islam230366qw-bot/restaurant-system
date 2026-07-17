@echo off
cd /d "C:\Users\islam\OneDrive\Desktop\سيستم"
color 0E
cls
echo ============================================
echo   فحص المتطلبات
echo ============================================
echo.

where node >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] Node.js موجود
    node --version
) else (
    echo [✗] Node.js مش موجود - لازم تثبته من https://nodejs.org
)

where npm >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] npm موجود
) else (
    echo [✗] npm مش موجود
)

where npx >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] npx موجود
) else (
    echo [✗] npx مش موجود
)

echo.
echo ============================================
echo   خلاصة: لو كل شيء [✓] يبقى جاهز
echo   لو في [✗] روح install Node.js من الموقع
echo ============================================
pause
