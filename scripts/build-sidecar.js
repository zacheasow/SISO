#!/usr/bin/env node

/**
 * build-sidecar.js
 * 
 * Compiles the Fastify local-server into a standalone binary using @yao-pkg/pkg,
 * then copies it to src-tauri/binaries/ with the correct target-triple naming
 * that Tauri expects for sidecar resolution.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BIN_DIR = path.join(ROOT, 'src-tauri', 'binaries');
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

  return `node20-${platformMap[platform]}-${archMap[arch]}`;
}

async function main() {
  const targetTriple = getTargetTriple();
  const pkgTarget = getPkgTarget();
  const ext = process.platform === 'win32' ? '.exe' : '';
  const sidecarName = `kumon-siso-server-${targetTriple}${ext}`;

  console.log(`\n=== Kumon SISO Sidecar Builder ===");
  console.log(`Target triple: ${targetTriple}`);
  console.log(`pkg target:    ${pkgTarget}`);
  console.log(`Output:        ${sidecarName}\n`);

  // Ensure output directories exist
  fs.mkdirSync(BIN_DIR, { recursive: true });
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

  // Step 3: Copy check-in-pwa dist to resources (sidecar will serve from here)
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

  console.log(`[4/4] Packaging sidecar with @yao-pkg/pkg...`);

  // pkg configuration: include sqlite3 native binding as an asset
  const pkgConfig = {
    targets: [pkgTarget],
    outputPath: outputPath,
    assets: findSqliteBindings(),
  };

  const assetsArgs = pkgConfig.assets.map(a => `--assets "${a}"`).join(' ');
  execSync(
    `npx --yes @yao-pkg/pkg "${entryPoint}" --target ${pkgTarget} --output "${outputPath}" ${assetsArgs}`,
    { stdio: 'inherit', cwd: ROOT }
  );

  // Also copy the sqlite3 native .node file to resources as a fallback
  const sqliteBindings = findSqliteNodeFile();
  if (sqliteBindings) {
    const destBinding = path.join(RES_DIR, 'node_sqlite3.node');
    fs.copyFileSync(sqliteBindings, destBinding);
    console.log(`Copied sqlite3 native binding to: ${destBinding}`);
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

/** Find sqlite3 native binding .node files for pkg assets */
function findSqliteBindings() {
  const bindingDir = path.join(ROOT, 'node_modules', 'sqlite3', 'lib', 'binding');
  const assets = [];
  if (fs.existsSync(bindingDir)) {
    assets.push(path.join(bindingDir, '**', '*.node'));
  }
  return assets;
}

/** Find the actual .node native module file */
function findSqliteNodeFile() {
  const bindingDir = path.join(ROOT, 'node_modules', 'sqlite3', 'lib', 'binding');
  if (!fs.existsSync(bindingDir)) return null;

  for (const subdir of fs.readdirSync(bindingDir)) {
    const nodeFile = path.join(bindingDir, subdir, 'node_sqlite3.node');
    if (fs.existsSync(nodeFile)) return nodeFile;
  }
  return null;
}

main().catch((err) => {
  console.error('\n❌ Sidecar build failed:', err.message);
  process.exit(1);
});
