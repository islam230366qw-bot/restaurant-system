const path = require('path');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const bcryptPath = path.join(__dirname, 'worker', 'node_modules', 'bcryptjs');
const bcrypt = require(bcryptPath);

async function main() {
  const fullName = await new Promise(r => rl.question('ادخل اسم الكاشير: ', r));
  const username = fullName.replace(/\s+/g, '_').toLowerCase();
  const password = 'Z_2000/Z_1';
  const hash = bcrypt.hashSync(password, 10);

  const sqlFile = path.join(__dirname, 'add-cashier.sql');
  const sql = `INSERT OR IGNORE INTO users (username, password_hash, full_name, role) VALUES ('${username}', '${hash}', '${fullName}', 'cashier');`;

  fs.writeFileSync(sqlFile, sql, 'utf8');

  console.log('\n====================================');
  console.log('✅ تم إنشاء ملف add-cashier.sql');
  console.log('');
  console.log('نفذ الأمر ده في CMD:');
  console.log('npx wrangler d1 execute restaurant-db --file=./add-cashier.sql --remote');
  console.log('');
  console.log('المستخدم: ' + username);
  console.log('كلمة السر: ' + password);
  console.log('الاسم: ' + fullName);
  console.log('====================================\n');

  rl.close();
}

main();
