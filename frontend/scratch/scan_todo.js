const fs = require('fs');
const path = require('path');

const dirs = ['frontend/db', 'frontend/hooks', 'frontend/services', 'backend/routes'];
const patterns = ['TODO', 'FIXME', 'mock', 'unimplemented', 'not implemented'];

dirs.forEach(d => {
  const dirPath = path.resolve(__dirname, '../..', d);
  if (!fs.existsSync(dirPath)) return;
  const files = fs.readdirSync(dirPath);
  files.forEach(f => {
    if (!f.endsWith('.ts') && !f.endsWith('.js')) return;
    const content = fs.readFileSync(path.join(dirPath, f), 'utf8');
    patterns.forEach(pat => {
      let pos = 0;
      while ((pos = content.toLowerCase().indexOf(pat, pos)) !== -1) {
        const line = content.substring(0, pos).split('\n').length;
        console.log(`[${pat.toUpperCase()}] ${d}/${f} at line ${line}`);
        pos += pat.length;
      }
    });
  });
});
