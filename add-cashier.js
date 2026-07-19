const { execSync } = require('child_process');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

const bcrypt = require(path.join(__dirname, 'worker', 'node_modules', 'bcryptjs'));

async function main() {
  const fullName = await ask('ادخل اسم الكاشير: ');
  const username = fullName.replace(/\s+/g, '_').toLowerCase();
  const password = await ask('ادخل كلمة المرور: ');
  const hash = bcrypt.hashSync(password, 10);
  const sql = `INSERT OR IGNORE INTO users (username, password_hash, full_name, role) VALUES ('${username.replace(/'/g, "''")}', '${hash.replace(/'/g, "''")}', '${fullName.replace(/'/g, "''")}', 'cashier');`;
  const sqlFile = path.join(__dirname, `_tmp_cashier_${Date.now()}.sql`);
  require('fs').writeFileSync(sqlFile, sql, 'utf8');
  try {
    execSync(`npx wrangler d1 execute restaurant-db --remote --file="${sqlFile}"`, { stdio: 'pipe', cwd: __dirname });
    console.log('\n====================================');
    console.log('✅ تم إنشاء الكاشير');
    console.log('المستخدم: ' + username);
    console.log('كلمة السر: (اللي دخلتها)');
    console.log('الاسم: ' + fullName);
    console.log('====================================\n');
  } catch (e) {
    console.log('فشل:', e.stderr?.toString() || e.message);
  }
  try { require('fs').unlinkSync(sqlFile); } catch {}
  rl.close();
}

main();
