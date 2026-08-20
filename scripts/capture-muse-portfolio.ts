import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const baseUrl = process.env.MUSE_CAPTURE_URL ?? "http://127.0.0.1:5175";
const projectId = process.env.MUSE_CAPTURE_PROJECT_ID ?? "f1000000-0000-4000-8000-000000000101";
const repoRoot = process.cwd();
const screenDirectory = path.join(repoRoot, "public", "portfolio", "muse", "screens");
const outputDirectory = path.join(repoRoot, "output", "muse-portfolio");

const productScreens = [
  ["01-overview.png", "overview"],
  ["02-brief.png", "brief"],
  ["03-evidence.png", "research"],
  ["04-insight.png", "insight"],
  ["05-direction.png", "direction"],
  ["06-concept.png", "concept"],
  ["07-material.png", "cmf"],
  ["08-review.png", "review"],
  ["09-version.png", "versions"],
  ["10-decision-map.png", "decision-map"],
] as const;

const sceneNames = [
  "01-hero",
  "02-problem",
  "03-strategy",
  "04-evidence-stack",
  "05-insight",
  "06-direction-hero",
  "07-direction-comparison",
  "08-concept",
  "09-review",
  "10-version",
  "11-decision-map",
  "12-final-system",
] as const;

async function settle(page: Page, selector: string) {
  await page.waitForSelector(selector, { state: "visible", timeout: 30_000 });
  await page.locator(selector).evaluate(async (root) => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(root.querySelectorAll("img")).map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            }),
      ),
    );
  });
  await page.waitForTimeout(500);
}

async function captureProductScreens(browser: Browser) {
  await mkdir(screenDirectory, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1200 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  for (const [fileName, route] of productScreens) {
    console.log(`Capturing product screen: ${fileName}`);
    const url = `${baseUrl}/projects/${projectId}/${route}?portfolio=true`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await settle(page, ".industrial-page");
    await page.screenshot({
      path: path.join(screenDirectory, fileName),
      fullPage: route === "decision-map",
      animations: "disabled",
    });
  }
  await context.close();
}

async function captureScene(
  page: Page,
  sceneName: (typeof sceneNames)[number],
) {
  console.log(`Capturing portfolio scene: ${sceneName}`);
  const selector = `[data-export-name="${sceneName}"]`;
  await settle(page, selector);
  const scene = page.locator(selector);
  await scene.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDirectory, `${sceneName}.png`),
    animations: "disabled",
  });
}

async function capturePortfolioScenes(browser: Browser) {
  await mkdir(outputDirectory, { recursive: true });
  const heroContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const heroPage = await heroContext.newPage();
  await heroPage.goto(`${baseUrl}/portfolio/muse/presentation?capture=true`, { waitUntil: "domcontentloaded" });
  await captureScene(heroPage, "01-hero");
  await heroContext.close();

  const sceneContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const scenePage = await sceneContext.newPage();
  await scenePage.goto(`${baseUrl}/portfolio/muse/presentation?capture=true`, { waitUntil: "domcontentloaded" });
  for (const sceneName of sceneNames.slice(1)) await captureScene(scenePage, sceneName);
  await sceneContext.close();
}

async function main() {
  const onlyProduct = process.argv.includes("--product");
  const onlyScenes = process.argv.includes("--scenes");
  const browser = await chromium.launch({ headless: true });
  try {
    if (!onlyScenes) await captureProductScreens(browser);
    if (!onlyProduct) await capturePortfolioScenes(browser);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
