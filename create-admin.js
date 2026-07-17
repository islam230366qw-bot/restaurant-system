const { execSync } = require('child_process');
const path = require('path');

const workerNodeModules = path.join(__dirname, 'worker', 'node_modules');
const bcrypt = require(path.join(workerNodeModules, 'bcryptjs'));

const password = 'admin123';
const hash = bcrypt.hashSync(password, 10);

try {
  console.log('جاري إنشاء مستخدم admin...');
  execSync(`npx wrangler d1 execute restaurant-db --remote --command="UPDATE users SET password_hash='${hash}' WHERE username='admin';"`, { stdio: 'pipe', cwd: __dirname });
  console.log('✓ تم تحديث كلمة السر');
} catch (e) {
  try {
    execSync(`npx wrangler d1 execute restaurant-db --remote --command="INSERT INTO users (username, password_hash, full_name, role) VALUES ('admin', '${hash}', 'مدير النظام', 'manager');"`, { stdio: 'pipe', cwd: __dirname });
    console.log('✓ تم إنشاء المستخدم');
  } catch (e2) {
    console.log('فشل:', e2.stderr?.toString() || e2.message);
  }
}

console.log('\n=============== ✅ ===============');
console.log('المستخدم: admin');
console.log('كلمة السر: ' + password);
console.log('==================================\n');
