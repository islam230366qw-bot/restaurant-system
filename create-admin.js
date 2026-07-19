const { execSync } = require('child_process');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

const bcrypt = require(path.join(__dirname, 'worker', 'node_modules', 'bcryptjs'));

async function main() {
  const password = await ask('ادخل كلمة المرور للمدير: ');
  const hash = bcrypt.hashSync(password, 10);
  const sqlFile = path.join(__dirname, `_tmp_admin_${Date.now()}.sql`);
  require('fs').writeFileSync(sqlFile, `INSERT OR IGNORE INTO users (username, password_hash, full_name, role) VALUES ('admin', '${hash.replace(/'/g, "''")}', 'مدير النظام', 'manager');`, 'utf8');
  try {
    execSync(`npx wrangler d1 execute restaurant-db --remote --file="${sqlFile}"`, { stdio: 'pipe', cwd: __dirname });
    console.log('\n✅ تم إنشاء مستخدم admin بنجاح');
  } catch {
    execSync(`npx wrangler d1 execute restaurant-db --remote --file="${sqlFile}"`, { stdio: 'pipe', cwd: __dirname });
  }
  try { require('fs').unlinkSync(sqlFile); } catch {}
  console.log('المستخدم: admin');
  console.log('كلمة السر: (اللي دخلتها)');
  rl.close();
}

main().catch((e) => { console.error('خطأ:', e.message); rl.close(); });
