#!/usr/bin/env node

/**
 * copy-release-exe.js
 *
 * Post-build helper that locates the freshly compiled Tauri desktop binary
 * (and the NSIS/MSI installers) inside src-tauri/target/release/ and copies
 * them to the repository root so the app can be launched without digging
 * into deep build folders.
 *
 *   src-tauri/target/release/kumon-siso.exe       -> ./Kumon SISO.exe
 *   src-tauri/target/release/bundle/nsis/*-setup.exe -> ./Kumon SISO Setup.exe
 *   src-tauri/target/release/bundle/msi/*.msi     -> ./Kumon SISO.msi
 *
 * This script only reads build outputs; it never modifies tauri.conf.json,
 * so externalBin / resource bundle paths are untouched.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(ROOT, 'src-tauri', 'target', 'release');
const CARGO_MANIFEST = path.join(ROOT, 'src-tauri', 'Cargo.toml');
const TAURI_CONF = path.join(ROOT, 'src-tauri', 'tauri.conf.json');

const isWin = process.platform === 'win32';

/** Read tauri.conf.json (tolerates JSONC comments / trailing commas / BOM) */
function readTauriConfig() {
  if (!fs.existsSync(TAURI_CONF)) return null;
  const raw = fs.readFileSync(TAURI_CONF, 'utf8').replace(/^\uFEFF/, '');
  try {
    return JSON.parse(stripJsonc(raw));
  } catch {
    return null;
  }
}

/** Strip // and /* *\/ comments and trailing commas without touching strings */
function stripJsonc(src) {
  let out = '';
  let inString = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += src[i + 1] ?? '';
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Cargo package name, used to prefer the main binary over the sidecar */
function readCargoPackageName() {
  if (!fs.existsSync(CARGO_MANIFEST)) return null;
  const match = fs.readFileSync(CARGO_MANIFEST, 'utf8').match(/^\s*name\s*=\s*"([^"]+)"/m);
  return match ? match[1] : null;
}

/** The compiled desktop executable (excludes the sidecar binary) */
function findMainBinary() {
  if (!fs.existsSync(RELEASE_DIR)) return null;
  const names = fs
    .readdirSync(RELEASE_DIR, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);

  const isExecutable = (name) => (isWin ? name.endsWith('.exe') : !name.includes('.'));
  const isSidecar = (name) =>
    /(^|[-_])(x86_64|i686|aarch64)-(pc-windows-msvc|unknown-linux-gnu|apple-darwin)(\.exe)?$/i.test(name) ||
    /server/i.test(name);

  const candidates = names.filter((n) => isExecutable(n) && !isSidecar(n));
  if (candidates.length === 0) return null;

  const pkgName = (readCargoPackageName() || 'kumon-siso').toLowerCase();
  const preferred = candidates.find((n) => path.basename(n, path.extname(n)).toLowerCase() === pkgName);
  const chosen = preferred || candidates[0];
  return path.join(RELEASE_DIR, chosen);
}

/** First matching file under a bundle subdir, e.g. bundle/nsis/*-setup.exe */
function findBundled(dirName, suffixes) {
  const dir = path.join(RELEASE_DIR, 'bundle', dirName);
  if (!fs.existsSync(dir)) return null;
  const match = fs.readdirSync(dir).find((name) => suffixes.some((s) => name.endsWith(s)));
  return match ? path.join(dir, match) : null;
}

/** Copy a single file, logging a clean completion message */
function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  const size = (fs.statSync(dest).size / 1024 / 1024).toFixed(1);
  console.log(`  ${path.basename(src)}  ->  ${path.relative(ROOT, dest)}  (${size} MB)`);
}

function main() {
  const config = readTauriConfig();
  const productName = config?.productName || 'Kumon SISO';
  const binExt = isWin ? '.exe' : '';

  console.log('\n=== Copy Release Build to Repository Root ===');

  let copiedAny = false;

  const mainBinary = findMainBinary();
  if (mainBinary) {
    const dest = path.join(ROOT, `${productName}${binExt}`);
    copyFile(mainBinary, dest);
    copiedAny = true;
  } else {
    console.warn('  [warn] No main desktop binary found in src-tauri/target/release/');
  }

  const nsisInstaller = findBundled('nsis', ['-setup.exe']);
  if (nsisInstaller) {
    copyFile(nsisInstaller, path.join(ROOT, `${productName} Setup.exe`));
    copiedAny = true;
  }

  const msiInstaller = findBundled('msi', ['.msi']);
  if (msiInstaller) {
    copyFile(msiInstaller, path.join(ROOT, `${productName}.msi`));
    copiedAny = true;
  }

  if (!copiedAny) {
    console.error('\n[error] Nothing to copy. Run a full build first:  npm run build:app');
    process.exit(1);
  }

  console.log(`\n✅ Release artifacts copied to repository root: ${ROOT}\n`);
}

main();
