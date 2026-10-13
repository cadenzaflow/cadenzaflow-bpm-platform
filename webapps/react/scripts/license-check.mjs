// Fails the build when an installed package uses a license outside the
// allow-lists below. Same lists as webapps/frontend/scripts/licenseCheck.js,
// but read through `npm query` so the check needs no extra dependency.
import { execFileSync } from 'node:child_process';

const PRODUCTION_LICENSES = [
  '0BSD',
  'Apache 2.0',
  'Apache-2.0',
  'Apache-2.0 WITH LLVM-exception',
  'BSD',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'ISC',
  'MIT',
  'WTFPL',
  'OFL-1.1',
];

// Build and test tools only (Vite's CSS minifier lightningcss is MPL-2.0,
// jsdom pulls MIT-0 and BlueOak packages); none of them ends up in the bundle.
const DEV_LICENSES = ['CC-BY-3.0', 'CC-BY-4.0', 'ODC-By-1.0', 'Unlicense', 'Zlib', 'MIT-0', 'BlueOak-1.0.0', 'MPL-2.0'];

// Individually reviewed exceptions to the production list.
const ALLOWED_PACKAGES = [
  // Unlicense (public domain); dependency of @tanstack/react-router, used for
  // server-side rendering only, which this app does not do.
  'isbot',
  // bpmn.io license = MIT plus: the bpmn.io watermark must stay visible.
  // Camunda Forms renderer, needed to show Camunda Forms in the Tasklist.
  '@bpmn-io/form-js-viewer',
];

function query(selector) {
  // npm_execpath points at the npm CLI that runs this script (also the one
  // installed by frontend-maven-plugin), so no global npm is needed.
  const npm = process.env.npm_execpath;
  const output = npm
    ? execFileSync(process.execPath, [npm, 'query', selector], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    : execFileSync('npm', ['query', selector], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: true });
  return JSON.parse(output);
}

function licensesOf(pkg) {
  const license = pkg.license ?? pkg.licenses;
  if (!license) {
    return { all: false, list: [] };
  }
  if (Array.isArray(license)) {
    return { all: false, list: license.map((l) => (typeof l === 'string' ? l : l.type)) };
  }
  const value = (typeof license === 'string' ? license : license.type).replace(/[()*]/g, '');
  if (value.includes(' AND ')) {
    return { all: true, list: value.split(' AND ') };
  }
  return { all: false, list: value.split(' OR ') };
}

function check(packages, allowed) {
  const problems = [];
  for (const pkg of packages) {
    if (ALLOWED_PACKAGES.includes(pkg.name)) {
      continue;
    }
    const { all, list } = licensesOf(pkg);
    const approved = all ? list.every((l) => allowed.includes(l)) : list.some((l) => allowed.includes(l));
    if (!approved) {
      problems.push(`${pkg.name}@${pkg.version} uses ${list.join(' OR ') || 'no declared license'}`);
    }
  }
  return problems;
}

const production = check(query('.prod'), PRODUCTION_LICENSES);
const development = check(query('.dev'), [...PRODUCTION_LICENSES, ...DEV_LICENSES]);

if (production.length || development.length) {
  console.error('License check did not pass');
  for (const line of [...production, ...development]) {
    console.error(`  ${line}`);
  }
  process.exit(1);
}
console.log('License check passed (production and development packages)');
