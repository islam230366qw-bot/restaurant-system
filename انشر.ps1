Write-Host "=== نشر نظام إدارة المطعم على Cloudflare ===" -ForegroundColor Green
Write-Host ""

# 1. تثبيت
Write-Host "[1/7] تثبيت الاعتماديات..." -ForegroundColor Cyan
Set-Location worker
npm install
Set-Location ..

Set-Location frontend
npm install
Set-Location ..

# 2. إنشاء قاعدة البيانات
Write-Host "[2/7] إنشاء قاعدة البيانات D1..." -ForegroundColor Cyan
$result = npx wrangler d1 create restaurant-db 2>&1
Write-Host $result

$dbId = Read-Host "ادخل database_id اللي طلع فوق (نسخ والصق)"
(Get-Content wrangler.toml) -replace 'database_id = ""', "database_id = `"$dbId`"" | Set-Content wrangler.toml

# 3. تنفيذ schema
Write-Host "[3/7] تنفيذ هيكل قاعدة البيانات..." -ForegroundColor Cyan
npx wrangler d1 execute restaurant-db --file=./schema.sql --remote

# 4. إنشاء R2
Write-Host "[4/7] إنشاء مخزن الصور..." -ForegroundColor Cyan
npx wrangler r2 bucket create restaurant-images

# 5. نشر API
Write-Host "[5/7] نشر الـ API..." -ForegroundColor Cyan
npx wrangler deploy

# 6. بناء ونشر الواجهة
Write-Host "[6/7] نشر الواجهة الأمامية..." -ForegroundColor Cyan
Set-Location frontend
npm run build
npx wrangler pages deploy ./dist --project-name restaurant-system
Set-Location ..

# 7. إنشاء مدير
Write-Host "[7/7] إنشاء أول مستخدم مدير..." -ForegroundColor Cyan
$pass = Read-Host "ادخل كلمة المرور للمدير"
npm install -g bcryptjs 2>$null
$hash = node -e "const b=require('bcryptjs');console.log(b.hashSync('$pass',10))"
npx wrangler d1 execute restaurant-db --remote --command="INSERT INTO users (username, password_hash, full_name, role) VALUES ('admin', '$hash', 'مدير النظام', 'manager');"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  تم النشر بنجاح!" -ForegroundColor Green
Write-Host "  المستخدم: admin" -ForegroundColor Yellow
Write-Host "  كلمة السر: $pass" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Green
Read-Host "اضغط Enter للخروج"
