// 导出本地 UI 概念 HTML 中的关键画面为 PNG，便于无生图权限时也能检查视觉方向。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playwrightModule = process.env.PLAYWRIGHT_MODULE_PATH ?? 'playwright';
const { chromium } = require(playwrightModule);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'mockups', 'ui-concepts.html');
const outputDir = path.join(root, 'assets', 'ui');

const shots = [
  ['home', 'local-ui-home-workspace.png'],
  ['collision', 'local-ui-collision-canvas.png'],
  ['detail', 'local-ui-idea-detail.png'],
  ['mobile', 'local-ui-mobile.png'],
  ['style-board', 'local-ui-style-board.png'],
];

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_EXECUTABLE_PATH,
});
const page = await browser.newPage({ viewport: { width: 1700, height: 1120 }, deviceScaleFactor: 1 });
await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`);

for (const [id, filename] of shots) {
  const element = page.locator(`#${id}`);
  await element.screenshot({ path: path.join(outputDir, filename) });
}

await browser.close();
console.log(JSON.stringify({ count: shots.length, outputDir }, null, 2));
