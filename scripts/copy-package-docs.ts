import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = process.cwd();

const packages = [
  {
    api: 'docs/api/@nkzw/fate',
    name: '@nkzw/fate',
    target: 'packages/fate/docs',
  },
  {
    api: 'docs/api/react-fate',
    name: 'react-fate',
    target: 'packages/react-fate/docs',
  },
] as const;

const assertDirectory = (path: string) => {
  if (!existsSync(path)) {
    throw new Error(`Missing docs directory: ${path}`);
  }
};

const toMarkdownPath = (fromDirectory: string, targetPath: string) =>
  relative(fromDirectory, targetPath).replaceAll('\\', '/');

const rewriteDocsLinks = (targetRoot: string, directory = targetRoot) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      rewriteDocsLinks(targetRoot, path);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const fromDirectory = dirname(relative(targetRoot, path));
    const content = readFileSync(path, 'utf8')
      .replaceAll(
        /\(\/(guide|integrations)\/([^)#]+?)(#[^)]+?)?\)/g,
        (_match, section: string, slug: string, hash = '') =>
          `(${toMarkdownPath(fromDirectory, join(section, `${slug}.md`))}${hash})`,
      )
      .replaceAll(/\(\/api([^)#]*)(#[^)]+?)?\)/g, (_match, suffix: string, hash = '') => {
        const apiPath = suffix ? join('api', suffix) : 'api/index.md';
        return `(${toMarkdownPath(fromDirectory, apiPath)}${hash})`;
      });
    writeFileSync(path, content);
  }
};

for (const packageDocs of packages) {
  const apiSource = join(root, packageDocs.api);
  const guideSource = join(root, 'docs/guide');
  const integrationsSource = join(root, 'docs/integrations');
  const target = join(root, packageDocs.target);

  assertDirectory(apiSource);
  assertDirectory(guideSource);
  assertDirectory(integrationsSource);

  rmSync(target, { force: true, recursive: true });
  mkdirSync(target, { recursive: true });

  cpSync(apiSource, join(target, 'api'), { recursive: true });
  cpSync(guideSource, join(target, 'guide'), { recursive: true });
  cpSync(integrationsSource, join(target, 'integrations'), { recursive: true });
  rewriteDocsLinks(target);

  writeFileSync(
    join(target, 'index.md'),
    `# ${packageDocs.name} Docs

- [Guides](guide/getting-started.md)
- [Integrations](integrations/server.md)
- [API Reference](api/index.md)
`,
  );

  console.log(`Copied docs for ${packageDocs.name} to ${packageDocs.target}`);
}
