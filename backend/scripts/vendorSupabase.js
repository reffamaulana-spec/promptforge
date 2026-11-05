const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
const target = path.join(__dirname, '..', '..', 'frontend', 'vendor', 'supabase.js');

if (!fs.existsSync(source)) {
  console.error('Paket @supabase/supabase-js belum terpasang. Jalankan: npm install');
  process.exit(1);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`Disalin ke ${path.relative(process.cwd(), target)}`);
