const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(workspaceRoot, 'package.json');
const cargoTomlPath = path.join(workspaceRoot, 'src-tauri-shell', 'Cargo.toml');
const tauriConfigPath = path.join(workspaceRoot, 'src-tauri-shell', 'tauri.conf.json');
const outputPath = path.join(workspaceRoot, 'src-tauri-shell', 'gen', 'build-info.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readCargoVersion(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^\s*version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error(`Unable to locate version in ${filePath}`);
  }
  return match[1];
}

function ensureVersionsMatch(...versions) {
  const [first, ...rest] = versions;
  if (rest.some((value) => value !== first)) {
    throw new Error(
      `Version mismatch detected. package.json=${versions[0]}, Cargo.toml=${versions[1]}, tauri.conf.json=${versions[2]}`,
    );
  }
  return first;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatOffset(date) {
  const totalMinutes = -date.getTimezoneOffset();
  const sign = totalMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(totalMinutes);
  const hours = pad(Math.floor(absoluteMinutes / 60));
  const minutes = pad(absoluteMinutes % 60);
  return `${sign}${hours}:${minutes}`;
}

function formatBuildTimestamp(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function formatIsoWithOffset(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${formatOffset(date)}`;
}

const packageJson = readJson(packageJsonPath);
const tauriConfig = readJson(tauriConfigPath);
const cargoVersion = readCargoVersion(cargoTomlPath);
const version = ensureVersionsMatch(packageJson.version, cargoVersion, tauriConfig.version);
const now = new Date();

const payload = {
  version,
  buildNumber: formatBuildTimestamp(now),
  builtAt: formatIsoWithOffset(now),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Generated build metadata: ${outputPath}`);
