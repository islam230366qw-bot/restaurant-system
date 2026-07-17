const path = require('path');
const fs = require('fs');

const bcryptPath = path.join(__dirname, 'worker', 'node_modules', 'bcryptjs');
const bcrypt = require(bcryptPath);

const password = 'admin123';
const hash = bcrypt.hashSync(password, 10);

const sqlFile = path.join(__dirname, 'fix-admin.sql');
const sql = `DELETE FROM users WHERE username = 'admin';
INSERT INTO users (username, password_hash, full_name, role) VALUES ('admin', '${hash}', 'مدير النظام', 'manager');`;

fs.writeFileSync(sqlFile, sql, 'utf8');

console.log('====================================');
console.log('تم إنشاء ملف fix-admin.sql');
console.log('نفذ الأمر ده في CMD:');
console.log('npx wrangler d1 execute restaurant-db --file=./fix-admin.sql --remote');
console.log('');
console.log('المستخدم: admin');
console.log('كلمة السر: ' + password);
console.log('====================================');
