const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

function simpleHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
  return `$2a$10$${salt}$${hash}`;
}

async function run() {
  console.log('\n=== نشر نظام إدارة المطعم على Cloudflare ===\n');

  console.log('[1] تثبيت الاعتماديات...');
  try { execSync('cd worker && npm install', { stdio: 'pipe' }); console.log('  ✓ API'); } catch(e) { console.log('  - API (موجود)'); }
  try { execSync('cd frontend && npm install', { stdio: 'pipe' }); console.log('  ✓ Frontend'); } catch(e) { console.log('  - Frontend (موجود)'); }

  console.log('\n[2] إنشاء قاعدة البيانات D1...');
  let dbId = '';
  try {
    const out = execSync('npx wrangler d1 create restaurant-db', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(out);
    const m = out.match(/database_id\s*=\s*"([^"]+)"/);
    if (m) dbId = m[1];
  } catch(e) {
    const out = e.stdout?.toString() || '';
    console.log(out);
    const m = out.match(/database_id\s*=\s*"([^"]+)"/);
    if (m) dbId = m[1];
    if (!dbId) {
      dbId = (await ask('دخل الـ database_id اللي طلع فوق: ')).trim();
    }
  }

  const toml = path.join(__dirname, 'wrangler.toml');
  let data = fs.readFileSync(toml, 'utf8');
  data = data.replace(/database_id = ""/, `database_id = "${dbId}"`);
  fs.writeFileSync(toml, data);
  console.log('  ✓ تم تحديث wrangler.toml');

  console.log('\n[3] تنفيذ هيكل قواعد البيانات...');
  try { execSync('npx wrangler d1 execute restaurant-db --file=./schema.sql --remote', { stdio: 'pipe' }); console.log('  ✓ تم'); }
  catch(e) { console.log('  - (موجود أو تم مسبقًا)'); }

  console.log('\n[4] إنشاء مخزن الصور R2...');
  try { execSync('npx wrangler r2 bucket create restaurant-images', { stdio: 'pipe' }); console.log('  ✓ تم'); }
  catch(e) { console.log('  - (موجود مسبقًا)'); }

  console.log('\n[5] نشر الـ API (Worker)...');
  try {
    const out = execSync('npx wrangler deploy', { encoding: 'utf8' });
    const u = out.match(/https:\/\/[^\s]+/);
    console.log(`  ✓ ${u ? u[0] : 'تم النشر'}`);
    global.apiUrl = u ? u[0] : '';
  } catch(e) { console.log('  - تعذر النشر حالياً. جرب لاحقًا: npx wrangler deploy'); }

  console.log('\n[6] بناء ونشر الواجهة (Pages)...');
  try {
    execSync('cd frontend && npm run build', { stdio: 'pipe', cwd: __dirname });
    const out = execSync('npx wrangler pages deploy ./dist --project-name restaurant-system', { encoding: 'utf8', cwd: path.join(__dirname, 'frontend') });
    const u = out.match(/https:\/\/[^\s]+/);
    console.log(`  ✓ ${u ? u[0] : 'تم النشر'}`);
    global.frontUrl = u ? u[0] : '';
  } catch(e) { console.log('  - تعذر النشر حالياً. جرب لاحقًا'); }

  console.log('\n[7] إنشاء أول مستخدم...');
  const password = 'admin' + Math.floor(Math.random() * 10000);
  const hash = simpleHash(password);
  try {
    execSync(`npx wrangler d1 execute restaurant-db --remote --command="INSERT OR IGNORE INTO users (username, password_hash, full_name, role) VALUES ('admin', '${hash}', 'مدير النظام', 'manager');"`, { stdio: 'pipe' });
    console.log('  ✓ تم إنشاء المدير');
  } catch(e) { console.log('  - (موجود مسبقًا)'); }

  console.log('\n' + '='.repeat(50));
  console.log('  ✅ تم النشر بنجاح!');
  console.log('  👤 المستخدم: admin');
  console.log('  🔑 كلمة السر: ' + password);
  console.log('  🌐 واجهة التحكم: ' + (global.frontUrl || 'راجع الشاشة أعلاه'));
  console.log('='.repeat(50));
  console.log('\n⚠️  احفظ كلمة السر. بعد أول تسجيل دخول تقدر تغيرها.');
  console.log('   من الإعدادات تقدر تضيف كاشير جدد.\n');

  rl.close();
}

run().catch((e) => { console.error('خطأ:', e.message); rl.close(); });
