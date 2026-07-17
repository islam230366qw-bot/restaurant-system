@echo off
cd /d "C:\Users\islam\OneDrive\Desktop\سيستم"
color 0A
cls
echo.
echo ============================================
echo   نشر نظام إدارة المطعم على Cloudflare
echo ============================================
echo.
echo جاري تشغيل script النشر التلقائي...
echo.
echo ملاحظة: لو طلب منك database_id انسخه من الشاشة والصقه
echo.
pause
echo.
node deploy.js
echo.
echo ============================================
echo   تم الانتهاء - راجع النتائج أعلاه
echo ============================================
pause
