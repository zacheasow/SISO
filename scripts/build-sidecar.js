#!/usr/bin/env node

/**
 * build-sidecar.js
 *
 * Compiles the Fastify local-server into a standalone binary using @yao-pkg/pkg,
 * then copies it to src-tauri/binaries/ with the correct target-triple naming
 * that Tauri expects for sidecar resolution.
 *
 * Required native SQLite bindings (node_sqlite3.node) are embedded into the
 * binary via pkg assets and also copied to src-tauri/bindings/ so they ship
 * alongside the desktop app as a fallback.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BIN_DIR = path.join(ROOT, 'src-tauri', 'binaries');
const BINDINGS_DIR = path.join(ROOT, 'src-tauri', 'bindings');
const RES_DIR = path.join(ROOT, 'src-tauri', 'resources');

// Map Node.js arch/platform to Rust target triples
function getTargetTriple() {
  const arch = process.arch;
  const platform = process.platform;

  const archMap = { x64: 'x86_64', arm64: 'aarch64', ia32: 'i686' };
  const platformMap = {
    win32: 'pc-windows-msvc',
    darwin: 'apple-darwin',
    linux: 'unknown-linux-gnu',
  };

  const rustArch = archMap[arch];
  const rustPlatform = platformMap[platform];
  if (!rustArch || !rustPlatform) {
    throw new Error(`Unsupported platform: ${platform}-${arch}`);
  }
  return `${rustArch}-${rustPlatform}`;
}

// Map to pkg target format
function getPkgTarget() {
  const arch = process.arch;
  const platform = process.platform;

  const platformMap = { win32: 'win', darwin: 'macos', linux: 'linux' };
  const archMap = { x64: 'x64', arm64: 'arm64' };

  const pkgPlatform = platformMap[platform];
  const pkgArch = archMap[arch];
  if (!pkgPlatform || !pkgArch) {
    throw new Error(`Unsupported platform: ${platform}-${arch}`);
  }

  return `node20-${pkgPlatform}-${pkgArch}`;
}

async function main() {
  const targetTriple = getTargetTriple();
  const pkgTarget = getPkgTarget();
  const ext = process.platform === 'win32' ? '.exe' : '';
  const sidecarName = `kumon-siso-server-${targetTriple}${ext}`;

  console.log(`\n=== Kumon SISO Sidecar Builder ===`);
  console.log(`Target triple: ${targetTriple}`);
  console.log(`pkg target:    ${pkgTarget}`);
  console.log(`Output:        ${sidecarName}\n`);

  // Ensure output directories exist
  fs.mkdirSync(BIN_DIR, { recursive: true });
  fs.mkdirSync(BINDINGS_DIR, { recursive: true });
  fs.mkdirSync(RES_DIR, { recursive: true });

  // Step 1: Build all packages and the local-server TypeScript
  console.log('[1/4] Building TypeScript packages...');
  execSync('npm run build:packages && npm run build --workspace=apps/local-server', {
    stdio: 'inherit',
    cwd: ROOT,
  });

  // Step 2: Build check-in-pwa (the sidecar will serve its dist/ as static files)
  console.log('[2/4] Building check-in-pwa for static serving...');
  execSync('npm run build --workspace=apps/check-in-pwa', {
    stdio: 'inherit',
    cwd: ROOT,
  });

  // Step 3: Copy check-in-pwa dist to resources (sidecar serves from here)
  const pwaDistSrc = path.join(ROOT, 'apps', 'check-in-pwa', 'dist');
  const pwaDistDest = path.join(RES_DIR, 'check-in-pwa');
  if (fs.existsSync(pwaDistDest)) {
    fs.rmSync(pwaDistDest, { recursive: true, force: true });
  }
  console.log('[3/4] Copying check-in-pwa dist to resources...');
  copyDirSync(pwaDistSrc, pwaDistDest);

  // Step 4: Compile the local-server into a standalone binary with pkg
  const entryPoint = path.join(ROOT, 'apps', 'local-server', 'dist', 'index.js');
  const outputPath = path.join(BIN_DIR, sidecarName);

  console.log('[4/4] Packaging sidecar with @yao-pkg/pkg...');

  // Native sqlite3 bindings and transitive deps are embedded via the `pkg` field in
  // apps/local-server/package.json (scripts/assets are resolved relative to that app dir).
  // `--config` is required: pkg only reads the `pkg` field from package.json when the
  // config is passed explicitly (an entry .js file otherwise makes pkg skip it).
  // `--public-packages "*"` embeds every transitive package as plain sources so that
  // dynamic / `exports`-field module resolution (e.g. es-get-iterator -> node.js) that
  // pkg's static walker cannot reach still works at runtime.
  const pkgConfig = path.join(ROOT, 'apps', 'local-server', 'package.json');
  execSync(
    `npx --yes @yao-pkg/pkg "${entryPoint}" --config "${pkgConfig}" --public-packages "*" --target ${pkgTarget} --output "${outputPath}"`,
    { stdio: 'inherit', cwd: ROOT }
  );

  // Also copy the sqlite3 native .node file to src-tauri/bindings/ as a fallback
  const sqliteNodeFile = findSqliteNodeFile();
  if (sqliteNodeFile) {
    const destBinding = path.join(BINDINGS_DIR, 'node_sqlite3.node');
    fs.copyFileSync(sqliteNodeFile, destBinding);
    console.log(`Copied sqlite3 native binding to: ${destBinding}`);
  } else {
    console.warn('[warn] Could not locate sqlite3 native binding (.node) to copy to bindings/');
  }

  console.log(`\n✅ Sidecar binary created: ${outputPath}`);
  console.log(`   Size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)} MB\n`);
}

/** Recursively copy a directory */
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** Locate the compiled sqlite3 native binding (.node file) for this platform */
function findSqliteNodeFile() {
  const candidates = [
    // node-gyp output used by the sqlite3 npm package
    path.join(ROOT, 'node_modules', 'sqlite3', 'build', 'Release', 'node_sqlite3.node'),
    // prebuilt binaries from @mapbox/node-pre-gyp / node-pre-gyp
    path.join(ROOT, 'node_modules', 'sqlite3', 'lib', 'binding'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && candidate.endsWith('.node')) {
      return candidate;
    }
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      const found = walkForNodeFile(candidate);
      if (found) return found;
    }
  }
  return null;
}

/** Depth-first search for a .node file under a directory */
function walkForNodeFile(dir) {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = walkForNodeFile(full);
      if (found) return found;
    } else if (entry.name.endsWith('.node')) {
      return full;
    }
  }
  return null;
}

main().catch((err) => {
  console.error('\n❌ Sidecar build failed:', err.message);
  process.exit(1);
});
