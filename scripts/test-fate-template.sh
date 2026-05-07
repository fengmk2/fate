#!/usr/bin/env bash
set -euo pipefail

template="${1:-default}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="${repo_root}/templates/fate/${template}"
tmp_root="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
work_root="${tmp_root%/}/fate-template-tests"
target_dir="${work_root}/${template}"

if [[ ! -d "${source_dir}" ]]; then
  echo "Unknown fate template: ${template}" >&2
  exit 1
fi

cd "${repo_root}"
vp run --filter '@nkzw/fate' build
vp run --filter react-fate build

rm -rf "${target_dir}"
mkdir -p "${work_root}"
cp -R "${source_dir}" "${target_dir}"

cat >"${target_dir}/server/.env" <<'EOF'
DATABASE_URL="postgresql://fate:echo@localhost:5432/fate"
BETTER_AUTH_SECRET="local-template-ci-secret-with-enough-entropy"
BETTER_AUTH_URL="http://localhost:9000"
CLIENT_DOMAIN="http://localhost:5173"
VITE_SERVER_URL="http://localhost:9000"
EOF

TEMPLATE_DIR="${target_dir}" \
FATE_PACKAGE="link:${repo_root}/packages/fate" \
REACT_FATE_PACKAGE="link:${repo_root}/packages/react-fate" \
node --input-type=module <<'EOF'
import { readFileSync, writeFileSync } from 'node:fs';

const path = `${process.env.TEMPLATE_DIR}/pnpm-workspace.yaml`;
const overrides = [
  `  '@nkzw/fate': ${JSON.stringify(process.env.FATE_PACKAGE)}`,
  `  react-fate: ${JSON.stringify(process.env.REACT_FATE_PACKAGE)}`,
].join('\n');

const content = readFileSync(path, 'utf8');

if (!content.includes('overrides:\n')) {
  throw new Error('Expected pnpm-workspace.yaml to contain an overrides block.');
}

writeFileSync(path, content.replace('overrides:\n', `overrides:\n${overrides}\n`));
EOF

cd "${target_dir}"
vp install --no-frozen-lockfile
vp run dev:setup
vp run fate:generate
vp check --fix
vp check
vp test
vp run build
