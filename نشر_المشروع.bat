@echo off
cd /d "C:\Users\islam\OneDrive\Desktop\سيستم"
echo ============================================
echo   بدء نشر نظام إدارة المطعم
echo ============================================
echo.

echo [1/7] تثبيت الاعتماديات للـ API...
cd worker
call npm install
cd ..
echo.

echo [2/7] تثبيت الاعتماديات للواجهة...
cd frontend
call npm install
cd ..
echo.

echo [3/7] إنشاء قاعدة البيانات...
npx wrangler d1 create restaurant-db
echo.
echo مهم: اخلق الـ database_id اللي طلع فوق وضعه في ملف wrangler.toml
echo في السطر: database_id = ""
echo بعدين اضغط أي زر عشان تكمل...
pause
echo.

echo [4/7] تنفيذ هيكل قاعدة البيانات...
npx wrangler d1 execute restaurant-db --file=./schema.sql --remote
echo.

echo [5/7] إنشاء مخزن الصور...
npx wrangler r2 bucket create restaurant-images
echo.

echo [6/7] نشر الـ API...
npx wrangler deploy
echo.

echo [7/7] نشر الواجهة الأمامية...
cd frontend
call npm run build
npx wrangler pages deploy ./dist
cd ..
echo.

echo ============================================
echo   تم النشر بنجاح!
echo ============================================
pause
