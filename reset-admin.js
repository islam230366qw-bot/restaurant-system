const path = require('path');
const fs = require('fs');

const bcryptPath = path.join(__dirname, 'worker', 'node_modules', 'bcryptjs');
const bcrypt = require(bcryptPath);

const password = 'admin123';
const hash = bcrypt.hashSync(password, 10);

const sql = `DELETE FROM users WHERE username = 'admin' OR username = 'admin123';
INSERT INTO users (username, password_hash, full_name, role) VALUES ('admin', '${hash}', 'مدير النظام', 'manager');`;

fs.writeFileSync(path.join(__dirname, 'reset-admin.sql'), sql, 'utf8');

console.log('✅ تم إنشاء reset-admin.sql');
console.log('');
console.log('نفذ الأمر ده في CMD:');
console.log('npx wrangler d1 execute restaurant-db --file=./reset-admin.sql --remote');
console.log('');
console.log('المستخدم: admin');
console.log('كلمة السر: ' + password);
