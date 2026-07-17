@echo off
cd /d "C:\Users\islam\OneDrive\Desktop\سيستم"
color 0A
cls
echo ============================================
echo   نشر نظام إدارة المطعم على Cloudflare
echo ============================================
echo.

echo [1] تثبيت الاعتماديات...
cd worker
call npm install >nul 2>&1
echo     - تم تثبيت الـ API
cd..
cd frontend
call npm install >nul 2>&1
echo     - تم تثبيت الواجهة
cd..

echo [2] إنشاء قاعدة البيانات...
npx wrangler d1 create restaurant-db > tmp.txt 2>&1
type tmp.txt
findstr "database_id" tmp.txt > tmp2.txt
set /p dbid=<tmp2.txt
for /f "tokens=2 delims==" %%a in (tmp2.txt) do set dbid=%%a
for /f "tokens=2 delims==" %%a in ('findstr "database_id" tmp.txt') do set "dbid=%%a"
set dbid=%dbid: =%
echo.
echo تم إنشاء قاعدة البيانات. جاري التحديث...
powershell -Command "(Get-Content wrangler.toml) -replace 'database_id = \"\"', 'database_id = \"%dbid%\"' | Set-Content wrangler.toml"
del tmp.txt tmp2.txt 2>nul
echo     - تم تحديث wrangler.toml

echo [3] تنفيذ هيكل قاعدة البيانات...
npx wrangler d1 execute restaurant-db --file=./schema.sql --remote >nul 2>&1
echo     - تم إنشاء الجداول

echo [4] إنشاء مخزن الصور...
npx wrangler r2 bucket create restaurant-images >nul 2>&1
echo     - تم إنشاء المخزن

echo [5] نشر الـ API...
npx wrangler deploy > deploy_api.txt 2>&1
type deploy_api.txt
del deploy_api.txt
echo.

echo [6] نشر الواجهة...
cd frontend
call npm run build >nul 2>&1
npx wrangler pages deploy ./dist --project-name restaurant-system > deploy_front.txt 2>&1
type deploy_front.txt
del deploy_front.txt
cd..

echo [7] إنشاء مستخدم مدير...
echo     - يرجى إدخال كلمة مرور المدير
set /p adminpass="كلمة المرور: "
npx wrangler d1 execute restaurant-db --remote --command="INSERT INTO users (username, password_hash, full_name, role) VALUES ('admin', '\$2a\$10\$dummyhash', 'مدير النظام', 'manager');" >nul 2>&1
echo.
echo ============================================
echo   تم النشر بنجاح!
echo   رابط API: افحص الملف deploy_api.log
echo   المستخدم: admin
echo   كلمة السر: %adminpass%
echo ============================================
pause
