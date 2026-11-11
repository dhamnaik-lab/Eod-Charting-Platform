const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(workspaceRoot, 'package.json');
const cargoTomlPath = path.join(workspaceRoot, 'src-tauri-shell', 'Cargo.toml');
const tauriConfigPath = path.join(workspaceRoot, 'src-tauri-shell', 'tauri.conf.json');
const outputPath = path.join(workspaceRoot, 'src-tauri-shell', 'gen', 'build-info.json');

// Windows occasionally refuses to open a file it has only just written because
// antivirus or the search indexer still holds a handle; Node surfaces that as
// `UNKNOWN` and the build dies before compiling anything. Retry those transient
// lock errors instead of failing the build.
function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function writeFileWithRetry(filePath, contents, attempts = 12) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      fs.writeFileSync(filePath, contents, 'utf8');
      return;
    } catch (error) {
      const code = error && error.code;
      const transient =
        code === 'UNKNOWN' || code === 'EBUSY' || code === 'EPERM' || code === 'EACCES';
      if (!transient || attempt >= attempts) {
        throw error;
      }
      sleepSync(Math.min(40 * attempt, 400));
    }
  }
}

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
writeFileWithRetry(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Generated build metadata: ${outputPath}`);
