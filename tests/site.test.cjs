/* Pruebas de integración sobre HTTP real. No consultan enlaces externos. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { createServer } = require('../scripts/serve.cjs');

const routes = ['/index.html', '/actos/fractura.html', '/actos/confrontacion.html', '/actos/forja.html', '/actos/soberania.html'];
const viewports = [[1920, 1080], [1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 667]];
const output = process.env.TEST_OUTPUT_DIR || path.join(__dirname, '..', 'test-results');

async function main() {
  await fs.mkdir(output, { recursive: true });
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const report = { pages: [], errors: [], localLinks: 0, noJavaScript: [], navigation: [] };

  try {
    for (const route of routes) {
      for (const [width, height] of viewports) {
        const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce', hasTouch: width < 600 });
        page.on('pageerror', error => report.errors.push(`${route}: ${error.message}`));
        page.on('requestfailed', request => report.errors.push(`${route}: ${request.url()} ${request.failure()?.errorText}`));
        page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
        await page.goto(base + route, { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
          await document.fonts.ready;
          document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
          await Promise.all([...document.images].map(image => image.decode()));
        });
        const metrics = await page.evaluate(() => {
          const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
          const missingLabels = [...document.querySelectorAll('[aria-labelledby]')].filter(element => element.getAttribute('aria-labelledby').split(/\s+/).some(id => !document.getElementById(id)));
          const heading = document.querySelector('h1').getBoundingClientRect();
          const nav = document.querySelector('.nav').getBoundingClientRect();
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
            missingLabels: missingLabels.length,
            h1Count: document.querySelectorAll('h1').length,
            headingInBounds: heading.left >= 0 && heading.right <= innerWidth + 1 && heading.top >= nav.bottom - 1,
            imagesMissingAlt: document.querySelectorAll('img:not([alt])').length,
            obsoleteLinks: document.querySelectorAll('a[href*="manifiesto.html"], .index-originals, .opening-bottom, .return-presence').length,
            chapters: document.querySelectorAll('article.chapter').length,
            localLinks: [...document.querySelectorAll('a[href]')].map(link => link.href).filter(href => href.startsWith(location.origin)),
            current: document.querySelectorAll('.nav-links [aria-current="page"]').length,
          };
        });
        assert.equal(metrics.overflow, false, `${route}: overflow at ${width}`);
        assert.deepEqual(metrics.duplicateIds, [], `${route}: duplicate IDs`);
        assert.equal(metrics.missingLabels, 0, `${route}: broken labels`);
        assert.equal(metrics.h1Count, 1);
        assert(metrics.headingInBounds, `${route}: heading overlaps navigation or overflows at ${width}`);
        assert.equal(metrics.imagesMissingAlt, 0);
        assert.equal(metrics.obsoleteLinks, 0);
        assert.equal(metrics.chapters, route === '/index.html' ? 0 : 2);
        assert.equal(metrics.current, route === '/index.html' ? 0 : 1);

        if (width === 1440) {
          for (const href of [...new Set(metrics.localLinks)]) {
            const url = new URL(href);
            const response = await page.request.get(url.origin + url.pathname);
            assert.equal(response.status(), 200, `Broken local link: ${href}`);
            if (url.hash) {
              const html = await response.text();
              const id = decodeURIComponent(url.hash.slice(1));
              assert(html.includes(`id="${id}"`), `Missing anchor: ${href}`);
            }
            report.localLinks++;
          }
          for (const link of await page.locator('.nav-links a').all()) {
            await link.hover();
            assert.equal(await link.evaluate(element => getComputedStyle(element, '::before').opacity), '1');
          }
          await page.mouse.move(1, 200);
          await page.locator('.nav-links a').first().focus();
          assert.equal(await page.locator('.nav-links a').first().evaluate(element => getComputedStyle(element, '::before').opacity), '1');
        }

        await page.locator('#indexToggle').click();
        assert(await page.locator('#editorialIndex').evaluate(dialog => dialog.open));
        assert.equal(await page.locator('#indexToggle').getAttribute('aria-expanded'), 'true');
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.keyboard.press('Shift+Tab');
        assert(await page.evaluate(() => document.querySelector('#editorialIndex').contains(document.activeElement)));
        await page.keyboard.press('Tab');
        assert(await page.evaluate(() => document.querySelector('#editorialIndex').contains(document.activeElement)));
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.querySelector('#indexToggle').getAttribute('aria-expanded') === 'false');
        assert.equal(await page.locator('#indexToggle').getAttribute('aria-expanded'), 'false');
        assert.equal(await page.evaluate(() => document.body.style.overflow), '');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'indexToggle');

        if (route !== '/index.html') {
          const details = page.locator('.source-notes').first();
          await details.locator('summary').click();
          assert(await details.evaluate(element => element.open));
          await details.locator('summary').click();
          await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
          await page.waitForFunction(() => document.querySelector('.reading-progress').getAttribute('aria-valuenow') === '100');
          await page.locator('.footer-meta a[href="#lectura"]').click();
          assert.equal(await page.evaluate(() => document.activeElement.id), 'lectura');
        }
        await page.evaluate(() => { document.activeElement.blur(); scrollTo(0, 0); });
        if (width === 1440 || width === 390) {
          const name = path.basename(route, '.html');
          await page.screenshot({ path: path.join(output, `${name}-${width}-hero.png`) });
          if (route !== '/index.html') {
            await page.locator('.chapter').first().scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(output, `${name}-${width}-chapter.png`) });
          }
          await page.locator('#indexToggle').click();
          await page.screenshot({ path: path.join(output, `${name}-${width}-index.png`) });
          await page.keyboard.press('Escape');
        }
        report.pages.push({ route, width, height, result: 'pass' });
        await page.close();
      }
    }

    // Exercise actual navigation between independent HTML documents.
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.goto(base + '/index.html');
    for (const route of routes.slice(1)) {
      await page.locator('.nav-links a').filter({ hasText: new RegExp(`^Acto ${['I', 'II', 'III', 'IV'][routes.indexOf(route) - 1]}$`) }).click();
      await page.waitForURL(base + route);
      report.navigation.push(route);
    }
    await page.locator('#indexToggle').click();
    await page.locator('.index-acts a').first().click();
    await page.waitForURL(base + '/actos/fractura.html');
    assert.equal(await page.locator('#indexToggle').getAttribute('aria-expanded'), 'false');
    await page.close();

    // Content must remain readable when scripting is unavailable.
    for (const route of routes) {
      const page = await browser.newPage({ javaScriptEnabled: false, reducedMotion: 'reduce' });
      await page.goto(base + route);
      assert(await page.locator('h1').isVisible());
      assert(await page.locator('.nav-links a').first().isVisible());
      if (route === '/index.html') assert.equal(await page.locator('#loader').isVisible(), false);
      report.noJavaScript.push(route);
      await page.close();
    }

    const animated = await browser.newPage({ reducedMotion: 'no-preference' });
    await animated.goto(base + '/index.html');
    await animated.locator('#loader').waitFor({ state: 'hidden' });
    assert(await animated.locator('h1').isVisible());
    await animated.close();
    assert.deepEqual(report.errors, []);
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`PASS: ${report.pages.length} combinaciones de página/pantalla, ${report.localLinks} enlaces locales, índice, teclado, fuentes, imágenes, progreso y lectura sin JavaScript.`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
