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
    await expect(actions).toHaveCount(5);
    for (let index = 0; index < 5; index += 1) await expect(actions.nth(index)).toBeInViewport();
    const secondary = await actions.evaluateAll((buttons) => buttons.slice(1).map((button) => {
      const rect = button.getBoundingClientRect(); return { width: rect.width, height: rect.height };
    }));
    expect(new Set(secondary.map(({ width }) => Math.round(width))).size).toBe(1);
    expect(new Set(secondary.map(({ height }) => Math.round(height))).size).toBe(1);

    const stage = await page.locator('.opening-menu > .stage').boundingBox();
    expect(stage).not.toBeNull();
    expect(stage!.x + stage!.width - (cardBox!.x + cardBox!.width)).toBeGreaterThan(viewport.width * 0.35);

    await page.getByRole('button', { name: 'CNS Atlas', exact: true }).click();
    const atlas = page.locator('.atlas-card');
    await expect(atlas).toContainText('CNS barriers and interfaces');
    for (const heading of ['CNS barriers and interfaces', 'Ventricular and craniospinal CSF anatomy', 'CNS myeloma compartments', 'Disease, ICANS, and abstractions']) {
      await expect(atlas.getByRole('heading', { level: 1 })).toHaveText(heading);
      const atlasBox = await atlas.boundingBox();
      expect(atlasBox).not.toBeNull();
      expect(atlasBox!.x + atlasBox!.width).toBeLessThanOrEqual(viewport.width * .55 + 1);
      expect(atlasBox!.y + atlasBox!.height).toBeLessThanOrEqual(viewport.height + 1);
      const next = page.getByRole('button', { name: 'Next', exact: true });
      if (await next.isVisible()) await next.click();
    }
    await expect(atlas).toContainText('tactical gameplay abstraction');
    await page.getByRole('button', { name: 'Back to menu' }).click();

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

test('portrait tablet uses compact campaign rows without splitting labels', async ({ page }) => {
  const viewport = { width: 870, height: 1194 };
  await page.setViewportSize(viewport);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('marrow-defense:highscore', '759');
    localStorage.setItem('marrow-defense:progress', JSON.stringify({
      cleared: { marrow: true, liver: true, cns: true },
      best: {
        marrow: { score: 625, response: 'VGPR' },
        liver: { score: 660, response: 'VGPR' },
        cns: { score: 482, response: 'SD' },
      },
    }));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Enter' }).click();

  const menu = page.locator('.start-card');
  const cards = menu.locator('.level-card');
  await expect(cards).toHaveCount(3);
  const cardBoxes = await cards.evaluateAll((nodes) => nodes.map((node) => {
    const box = node.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }));
  expect(new Set(cardBoxes.map(({ x }) => Math.round(x))).size).toBe(1);
  expect(cardBoxes[1].y).toBeGreaterThan(cardBoxes[0].y + cardBoxes[0].height - 1);
  expect(cardBoxes[2].y).toBeGreaterThan(cardBoxes[1].y + cardBoxes[1].height - 1);

  const compactLabels = menu.locator('.lc-name, .lc-difficulty, .lc-best, .lc-state');
  for (let index = 0; index < await compactLabels.count(); index += 1) {
    const label = compactLabels.nth(index);
    await expect(label).toHaveCSS('white-space', 'nowrap');
    const fits = await label.evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
    expect(fits).toBe(true);
  }
  await expect(menu.locator('.lc-name')).toHaveText(['Marrow', 'Hepatic', 'Neuroaxis']);

  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThanOrEqual(0);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(viewport.height + 1);
  const actions = menu.locator('.menu-actions .btn');
  for (let index = 0; index < await actions.count(); index += 1) await expect(actions.nth(index)).toBeInViewport();
});

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
  await page.keyboard.press(' ');
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

test('Neuroaxis keeps CNS status and containment in the iPhone top HUD', async ({ page }) => {
  const viewport = { width: 844, height: 390 };
  await page.setViewportSize(viewport);
  await openMainMenu(page);
  await page.evaluate(() => localStorage.setItem('marrow-defense:settings', JSON.stringify({ tutorialSeen: true, speed: 3 })));
  await page.reload();
  await page.getByRole('button', { name: 'Enter' }).click();
  await page.getByRole('button', { name: /Neuroaxis EXPERT/ }).click();
  await page.getByRole('button', { name: 'Start Neuroaxis — Expert' }).click();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: /Contain spinal barrier entry/i })).toBeVisible({ timeout: 5_000 });
  const [cnsHud, hud, stage, units, abilities] = await Promise.all([
    page.locator('.cns-hud').boundingBox(), page.locator('.hud').boundingBox(), page.locator('.stage').boundingBox(),
    page.locator('.units').boundingBox(), page.locator('.abilities').boundingBox(),
  ]);
  expect(cnsHud && hud && stage && units && abilities).toBeTruthy();
  expect(cnsHud!.y).toBeGreaterThanOrEqual(hud!.y - 1);
  expect(cnsHud!.y + cnsHud!.height).toBeLessThanOrEqual(hud!.y + hud!.height + 1);
  expect(units!.x + units!.width).toBeLessThanOrEqual(stage!.x + 1);
  expect(abilities!.x).toBeGreaterThanOrEqual(stage!.x + stage!.width - 1);
  await expect(page.locator('.banner')).toBeHidden();
  await page.keyboard.press('r');
  await expect(page.locator('.cns-hud')).toContainText('DELAYED');
});

test('cord-only Neuroaxis anatomy remains unobstructed at every viewport', async ({ page }) => {
  test.setTimeout(30_000);
  const viewports = [...landscapePhones, { width: 1440, height: 900 }];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await openMainMenu(page);
    await page.getByRole('button', { name: /Neuroaxis EXPERT/ }).click();
    await page.getByRole('button', { name: 'Start Neuroaxis — Expert' }).click();

    const canvas = page.locator('.stage canvas');
    await expect(canvas).toHaveAttribute('aria-label', /showing only a prominent posterior spinal cord/i);
    await expect(page.locator('.cns-anatomy-a11y')).toContainText('Cauda equina');
    const [stageBox, canvasBox, unitBox, abilityBox] = await Promise.all([
      page.locator('.stage').boundingBox(), canvas.boundingBox(),
      page.locator('.units').boundingBox(), page.locator('.abilities').boundingBox(),
    ]);
    expect(stageBox && canvasBox && unitBox && abilityBox).toBeTruthy();
    expect(Math.abs(stageBox!.width / stageBox!.height - 16 / 9)).toBeLessThan(.03);
    expect(Math.abs(canvasBox!.width - stageBox!.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(canvasBox!.height - stageBox!.height)).toBeLessThanOrEqual(2);
    if (viewport.width < 900) {
      expect(unitBox!.x + unitBox!.width).toBeLessThanOrEqual(stageBox!.x + 1);
      expect(abilityBox!.x).toBeGreaterThanOrEqual(stageBox!.x + stageBox!.width - 1);
    } else {
      expect(unitBox!.y).toBeGreaterThanOrEqual(stageBox!.y + stageBox!.height - 1);
      expect(abilityBox!.y).toBeGreaterThanOrEqual(stageBox!.y + stageBox!.height - 1);
    }
  }
});
