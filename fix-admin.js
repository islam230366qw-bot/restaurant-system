const { execSync } = require('child_process');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

const bcrypt = require(path.join(__dirname, 'worker', 'node_modules', 'bcryptjs'));

async function main() {
  const password = await ask('ادخل كلمة المرور الجديدة للمدير: ');
  const hash = bcrypt.hashSync(password, 10);
  const sql = `DELETE FROM users WHERE username = 'admin';\nINSERT INTO users (username, password_hash, full_name, role) VALUES ('admin', '${hash.replace(/'/g, "''")}', 'مدير النظام', 'manager');`;
  const sqlFile = path.join(__dirname, `_tmp_fix_${Date.now()}.sql`);
  require('fs').writeFileSync(sqlFile, sql, 'utf8');
  try {
    execSync(`npx wrangler d1 execute restaurant-db --remote --file="${sqlFile}"`, { stdio: 'pipe', cwd: __dirname });
    console.log('\n✅ تم إصلاح مستخدم admin');
  } catch (e) {
    console.log('فشل:', e.stderr?.toString() || e.message);
  }
  try { require('fs').unlinkSync(sqlFile); } catch {}
  rl.close();
}

main();
