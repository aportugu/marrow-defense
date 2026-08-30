import { expect, test, type Page } from '@playwright/test';

const landscapePhones = [
  { width: 568, height: 320 },
  { width: 667, height: 375 },
  { width: 844, height: 390 },
];

async function openMainMenu(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(page.locator('.start-card')).toBeVisible();
}

for (const viewport of landscapePhones) {
  test(`landscape phone geometry ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openMainMenu(page);

    const card = page.locator('.start-card');
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(cardBox!.x).toBeGreaterThanOrEqual(0);
    expect(cardBox!.y).toBeGreaterThanOrEqual(0);
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(viewport.width * 0.55 + 1);
    expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(viewport.height + 1);

    const actions = page.locator('.start-card .menu-actions .btn');
    await expect(actions).toHaveCount(4);
    for (let index = 0; index < 4; index += 1) await expect(actions.nth(index)).toBeInViewport();
    const secondary = await actions.evaluateAll((buttons) => buttons.slice(1).map((button) => {
      const rect = button.getBoundingClientRect(); return { width: rect.width, height: rect.height };
    }));
    expect(new Set(secondary.map(({ width }) => Math.round(width))).size).toBe(1);
    expect(new Set(secondary.map(({ height }) => Math.round(height))).size).toBe(1);

    const stage = await page.locator('.opening-menu > .stage').boundingBox();
    expect(stage).not.toBeNull();
    expect(stage!.x + stage!.width - (cardBox!.x + cardBox!.width)).toBeGreaterThan(viewport.width * 0.35);

    await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
    const tutorial = page.locator('.tutorial-card');
    await expect(tutorial).toBeVisible();
    for (const heading of ['Mission and game loop', 'Build your CAR-T defense', 'Match toxicity to treatment', 'Read the battlefield']) {
      await expect(tutorial.getByRole('heading', { level: 1 })).toHaveText(heading);
      const tutorialBox = await tutorial.boundingBox();
      expect(tutorialBox).not.toBeNull();
      expect(tutorialBox!.x + tutorialBox!.width).toBeLessThanOrEqual(viewport.width * 0.55 + 1);
      expect(tutorialBox!.y).toBeGreaterThanOrEqual(0);
      expect(tutorialBox!.y + tutorialBox!.height).toBeLessThanOrEqual(viewport.height + 1);
      const tutorialActions = tutorial.locator('.menu-actions .btn');
      for (let index = 0; index < await tutorialActions.count(); index += 1) {
        await expect(tutorialActions.nth(index)).toBeInViewport();
      }
      if (heading === 'Match toxicity to treatment') {
        await expect(tutorial).toContainText('Tocilizumab → CRS');
        await expect(tutorial).toContainText('Dexamethasone → Neurotoxicity');
        await expect(tutorial.locator('.tutorial-body')).toHaveCSS('overflow-y', 'auto');
        const finalTreatment = tutorial.getByRole('heading', { name: 'Stem-Cell Boost → Major recovery' });
        await finalTreatment.scrollIntoViewIfNeeded();
        await expect(finalTreatment).toBeInViewport();
      }
      const next = page.getByRole('button', { name: 'Next', exact: true });
      if (await next.isVisible()) await next.click();
    }
    await expect(tutorial).toContainText('not medical advice');
    const guidedStart = page.getByRole('button', { name: 'Start Guided Marrow Run' });
    await expect(guidedStart).toBeInViewport();
    await guidedStart.click();
    await expect(page.locator('.menu')).toHaveClass(/hidden/);
    await expect(page.locator('.guided-hint')).toContainText('1/5 · CHOOSE A UNIT');
    const [gameStage, canvas, units, abilities, hud, banner] = await Promise.all([
      page.locator('.stage').boundingBox(), page.locator('.stage canvas').boundingBox(),
      page.locator('.units').boundingBox(), page.locator('.abilities').boundingBox(),
      page.locator('.hud').boundingBox(), page.locator('.banner').boundingBox(),
    ]);
    expect(gameStage && canvas && units && abilities && hud && banner).toBeTruthy();
    expect(Math.abs(gameStage!.width / gameStage!.height - 16 / 9)).toBeLessThan(0.03);
    expect(Math.abs(canvas!.width - gameStage!.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(canvas!.height - gameStage!.height)).toBeLessThanOrEqual(2);
    expect(units!.x + units!.width).toBeLessThanOrEqual(gameStage!.x + 1);
    expect(abilities!.x).toBeGreaterThanOrEqual(gameStage!.x + gameStage!.width - 1);
    expect(banner!.y).toBeGreaterThanOrEqual(hud!.y - 1);
    expect(banner!.y + banner!.height).toBeLessThanOrEqual(hud!.y + hud!.height + 1);

    await page.evaluate(() => {
      const notice = document.createElement('div');
      notice.className = 'notice test-notice';
      notice.textContent = 'Responsive alert';
      document.body.appendChild(notice);
    });
    const notice = page.locator('.test-notice');
    const noticeBox = await notice.boundingBox();
    expect(noticeBox).not.toBeNull();
    expect(noticeBox!.x).toBeGreaterThanOrEqual(0);
    expect(noticeBox!.x + noticeBox!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(viewport.height + 1);
    await expect(notice).toHaveCSS('pointer-events', 'none');
  });
}

test('portrait phone displays the rotation guard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const guard = page.locator('.rotate-overlay');
  await expect(guard).toBeVisible();
  await expect(guard).toHaveAttribute('aria-hidden', 'false');
  await expect(guard).toContainText('Rotate to landscape');
});

test('guided reinforcement pauses wave 2 in the iPhone top HUD', async ({ page }) => {
  test.setTimeout(50_000);
  const viewport = { width: 844, height: 390 };
  await page.setViewportSize(viewport);
  await openMainMenu(page);
  await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Start Guided Marrow Run' }).click();

  const canvas = page.locator('.stage canvas');
  const canvasPoint = async (x: number, y: number) => {
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + x / 1280 * box!.width, box!.y + y / 720 * box!.height);
  };

  await page.keyboard.press('q');
  await canvasPoint(350, 370);
  await expect(page.locator('.guided-hint')).toContainText('3/5 · START THE WAVE');
  await page.getByRole('button', { name: 'Start now' }).click();
  await page.locator('.hud-right .btn').first().click();
  await page.locator('.hud-right .btn').first().click();

  const reinforcement = page.locator('.guided-hint');
  await expect(reinforcement).toContainText('5/5 · REINFORCE', { timeout: 35_000 });
  const [hintBox, hudBox, stageBox] = await Promise.all([
    reinforcement.boundingBox(), page.locator('.hud').boundingBox(), page.locator('.stage').boundingBox(),
  ]);
  expect(hintBox && hudBox && stageBox).toBeTruthy();
  expect(hintBox!.y).toBeGreaterThanOrEqual(hudBox!.y - 1);
  expect(hintBox!.y + hintBox!.height).toBeLessThanOrEqual(hudBox!.y + hudBox!.height + 1);
  expect(stageBox!.width / stageBox!.height).toBeCloseTo(16 / 9, 1);
  await expect(page.getByRole('button', { name: 'Build to continue' })).toBeDisabled();

  await page.keyboard.press('e');
  await canvasPoint(700, 200);
  await expect(reinforcement).toBeHidden();
});

test('desktop retains menu and battlefield geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openMainMenu(page);
  const menu = await page.locator('.start-card').boundingBox();
  const stage = await page.locator('.opening-menu > .stage').boundingBox();
  expect(menu && stage).toBeTruthy();
  expect(menu!.width).toBeGreaterThan(500);
  expect(stage!.width).toBeGreaterThan(900);
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(stage!.x + stage!.width * 0.52 + 1);
  await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
  const tutorial = page.locator('.tutorial-card');
  await expect(tutorial).toBeVisible();
  await expect(tutorial).toContainText('Mission and game loop');
  await expect(tutorial).toContainText('not medical advice');
  const tutorialBox = await tutorial.boundingBox();
  expect(tutorialBox).not.toBeNull();
  expect(tutorialBox!.x + tutorialBox!.width).toBeLessThanOrEqual(stage!.x + stage!.width * 0.52 + 1);
  await page.getByRole('button', { name: 'Back to menu' }).click();
  await page.getByRole('button', { name: 'Start Marrow' }).click();
  const gameStage = await page.locator('.stage').boundingBox();
  const canvas = await page.locator('.stage canvas').boundingBox();
  expect(gameStage && canvas).toBeTruthy();
  expect(Math.abs(gameStage!.width / gameStage!.height - 16 / 9)).toBeLessThan(0.03);
  expect(Math.abs(canvas!.width - gameStage!.width)).toBeLessThanOrEqual(2);
});
