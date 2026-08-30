export const customerWebStarterFiles = () => ({
  '.gitignore': `.next/\nnode_modules/\nplaywright-report/\ntest-results/\n.env*\n!.env.example\n`,
  'AGENTS.md': `# Akinael Customer Web Project\n\nこのrepositoryはアキナエルAIの自動制作対象です。\n\n## 自律実行\n- Research / Direction / Build / QA / Reviewは内部工程として進める。\n- 通常の制作判断で人間確認を挟まない。\n- 本番公開、DNS変更、新規課金、破壊的変更、未確認の正式情報だけをHuman Gateとする。\n\n## 品質\n- npm run qa を必ず通す。\n- テストや検査基準を弱めてPASSにしない。\n- モバイル/デスクトップ双方を実ブラウザで確認する。\n- 汎用的なAIコピー、不要なカード化、過剰な角丸/影、意味のない英語装飾を避ける。\n- 実績、料金、会社情報など未確認の事実を捏造しない。\n\n## Repository boundary\n- .github/、AGENTS.md、.akinael/ は制御領域。制作タスクから変更しない。\n- 作業は akinael/run-* branch 上で行い、mainへのmergeとproduction deployはHuman Gate。\n`,
  'package.json': JSON.stringify({
    name: 'akinael-customer-web',
    version: '0.1.0',
    private: true,
    type: 'module',
    engines: { node: '>=22.13.0' },
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      lint: 'eslint . --max-warnings=0',
      typecheck: 'tsc --noEmit',
      'test:e2e': 'playwright test',
      qa: 'npm run lint && npm run typecheck && npm run build && npm run test:e2e'
    },
    dependencies: { next: '16.3.3', react: '19.2.8', 'react-dom': '19.2.8' },
    devDependencies: {
      '@playwright/test': '^1.62.0',
      '@types/node': '^24.0.0',
      '@types/react': '^19.2.0',
      '@types/react-dom': '^19.2.0',
      eslint: '^9.0.0',
      'eslint-config-next': '16.3.3',
      typescript: '6.0.3'
    }
  }, null, 2) + '\n',
  'eslint.config.mjs': `import { defineConfig, globalIgnores } from 'eslint/config';\nimport nextVitals from 'eslint-config-next/core-web-vitals';\nimport nextTs from 'eslint-config-next/typescript';\n\nexport default defineConfig([\n  ...nextVitals,\n  ...nextTs,\n  globalIgnores(['.next/**', 'out/**', 'playwright-report/**', 'test-results/**']),\n]);\n`,
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      target: 'ES2017',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: false,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'react-jsx',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./src/*'] }
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts', '.next/dev/types/**/*.ts'],
    exclude: ['node_modules']
  }, null, 2) + '\n',
  'next-env.d.ts': `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n\n// This file is generated/maintained by Next.js.\n`,
  'next.config.ts': `import type { NextConfig } from 'next';\n\nconst nextConfig: NextConfig = {};\nexport default nextConfig;\n`,
  'playwright.config.ts': `import { defineConfig, devices } from '@playwright/test';\n\nexport default defineConfig({\n  testDir: './tests',\n  fullyParallel: true,\n  forbidOnly: true,\n  retries: 1,\n  reporter: 'list',\n  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },\n  webServer: { command: 'npm run start', url: 'http://127.0.0.1:3000', reuseExistingServer: false },\n  projects: [\n    { name: 'mobile-375', use: { ...devices['iPhone 13'] } },\n    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } }\n  ]\n});\n`,
  'src/app/layout.tsx': `import type { Metadata } from 'next';\nimport './globals.css';\n\nexport const metadata: Metadata = { title: 'Project', description: 'Akinael AI project' };\n\nexport default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {\n  return <html lang="ja"><body>{children}</body></html>;\n}\n`,
  'src/app/page.tsx': `export default function Home() {\n  return (\n    <main className="starter">\n      <p>Akinael AI production workspace</p>\n      <h1>Project setup is ready.</h1>\n    </main>\n  );\n}\n`,
  'src/app/globals.css': `* { box-sizing: border-box; }\nhtml, body { margin: 0; min-height: 100%; }\nbody { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }\n.starter { min-height: 100vh; display: grid; place-content: center; gap: 12px; padding: 32px; }\n.starter p, .starter h1 { margin: 0; }\n`,
  'tests/smoke.spec.ts': `import { test, expect } from '@playwright/test';\n\ntest('page renders without horizontal overflow', async ({ page }) => {\n  await page.goto('/');\n  await expect(page.locator('body')).toBeVisible();\n  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);\n  expect(overflow).toBe(false);\n});\n`
});
