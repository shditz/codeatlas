import fs from 'node:fs';
import path from 'node:path';

const TARGET_VERSION = '2.0.0';
const rootDir = process.cwd();

function updatePackageJson(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  const pkg = JSON.parse(content);
  pkg.version = TARGET_VERSION;

  // Also update workspace dependency versions if specified with fixed versions
  if (pkg.dependencies) {
    for (const dep of Object.keys(pkg.dependencies)) {
      if (dep.startsWith('@codeatlas-ai/') && pkg.dependencies[dep] !== 'workspace:*') {
        pkg.dependencies[dep] = `^${TARGET_VERSION}`;
      }
    }
  }
  if (pkg.devDependencies) {
    for (const dep of Object.keys(pkg.devDependencies)) {
      if (dep.startsWith('@codeatlas-ai/') && pkg.devDependencies[dep] !== 'workspace:*') {
        pkg.devDependencies[dep] = `^${TARGET_VERSION}`;
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  console.log(`Updated version in ${filePath}`);
}

// 1. Root package.json
updatePackageJson(path.join(rootDir, 'package.json'));

// 2. Packages
const packagesDir = path.join(rootDir, 'packages');
if (fs.existsSync(packagesDir)) {
  const dirs = fs.readdirSync(packagesDir);
  for (const dir of dirs) {
    const pkgPath = path.join(packagesDir, dir, 'package.json');
    updatePackageJson(pkgPath);
  }
}

// 3. Apps
const appsDir = path.join(rootDir, 'apps');
if (fs.existsSync(appsDir)) {
  const dirs = fs.readdirSync(appsDir);
  for (const dir of dirs) {
    const pkgPath = path.join(appsDir, dir, 'package.json');
    updatePackageJson(pkgPath);
  }
}

// 4. CLI index.ts
const cliIndexPath = path.join(rootDir, 'apps', 'cli', 'src', 'index.ts');
if (fs.existsSync(cliIndexPath)) {
  let content = fs.readFileSync(cliIndexPath, 'utf-8');
  content = content.replace(/\.version\(['"][^'"]+['"]\)/, `.version('${TARGET_VERSION}')`);
  fs.writeFileSync(cliIndexPath, content, 'utf-8');
  console.log(`Updated CLI version in ${cliIndexPath}`);
}

// 5. Root README.md
const readmePath = path.join(rootDir, 'README.md');
if (fs.existsSync(readmePath)) {
  let content = fs.readFileSync(readmePath, 'utf-8');
  content = content.replace(
    /codeatlas-(?:official|vscode)-[0-9.]+\.vsix/g,
    `codeatlas-official-${TARGET_VERSION}.vsix`,
  );
  fs.writeFileSync(readmePath, content, 'utf-8');
  console.log(`Updated README.md references`);
}

// 6. Extension README.md
const extReadmePath = path.join(rootDir, 'apps', 'vscode-extension', 'README.md');
if (fs.existsSync(extReadmePath)) {
  let content = fs.readFileSync(extReadmePath, 'utf-8');
  content = content.replace(/version-[0-9.]+-blue/g, `version-${TARGET_VERSION}-blue`);
  content = content.replace(
    /codeatlas-(?:official|vscode)-[0-9.]+\.vsix/g,
    `codeatlas-official-${TARGET_VERSION}.vsix`,
  );
  fs.writeFileSync(extReadmePath, content, 'utf-8');
  console.log(`Updated extension README.md references`);
}

console.log(`\nSuccessfully bumped all packages and references to v${TARGET_VERSION}!`);
