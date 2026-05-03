const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const upgradesDir = path.join(__dirname, 'upgrades');
const appliedFile = path.join(__dirname, '.upgrades_applied');

function getApplied() {
  if (!fs.existsSync(appliedFile)) return [];
  return JSON.parse(fs.readFileSync(appliedFile, 'utf8'));
}

function markApplied(name) {
  const applied = getApplied();
  applied.push({ name, appliedAt: new Date().toISOString() });
  fs.writeFileSync(appliedFile, JSON.stringify(applied, null, 2));
}

async function run() {
  const applied = getApplied().map(a => a.name);
  const files = fs.readdirSync(upgradesDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  const pending = files.filter(f => !applied.includes(f));

  if (!pending.length) {
    console.log('✅ All upgrades already applied.');
    return;
  }

  for (const file of pending) {
    console.log(`\n🔧 Applying upgrade: ${file}`);
    try {
      const upgrade = require(path.join(upgradesDir, file));
      await upgrade.apply();
      markApplied(file);
      console.log(`✅ ${file} applied successfully.`);
    } catch (err) {
      console.error(`❌ ${file} failed:`, err.message);
      process.exit(1);
    }
  }

  console.log('\n🍉 All upgrades applied. Restart the server.');
}

run();
