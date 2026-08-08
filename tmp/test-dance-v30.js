(async (page) => {
  await page.setViewportSize({ width: 420, height: 720 });

  const payload = {
    mode: "dance",
    title: "무용도 춤 발판",
    subtitle: "고구려 귀족의 춤과 음악",
    targetCount: 20,
    targetScore: 20,
    durationSeconds: 0,
    instruction: "화살표 순서대로 발판을 밟으세요.",
    sequence: [
      "left",
      "up",
      "right",
      "down",
      "up",
      "left",
      "down",
      "right",
      "up",
      "right",
      "left",
      "down",
      "up",
      "right",
      "down",
      "left",
      "up",
      "down",
      "right",
      "up",
    ],
    characterImage: "images/muheui.png",
  };

  await page.evaluate((nextPayload) => {
    window.postMessage({ type: "mission-game:init", payload: nextPayload }, "*");
  }, payload);
  await page.waitForTimeout(300);
  await page.locator("[data-start]").click();
  await page.waitForTimeout(200);

  for (const direction of payload.sequence.slice(0, 10)) {
    await page.locator(`[data-direction="${direction}"]`).click();
    await page.waitForTimeout(95);
  }

  await page.waitForTimeout(80);
  await page.screenshot({
    path: "output/playwright/dance-v30-eight-frame-check/start.png",
    fullPage: false,
  });

  const frames = [];
  for (let index = 0; index < 16; index += 1) {
    await page.waitForTimeout(40);
    const path = `output/playwright/dance-v30-eight-frame-check/frame-${String(index).padStart(
      2,
      "0"
    )}.png`;
    await page.screenshot({ path, fullPage: false });
    frames.push(path);
  }

  const info = await page.evaluate(() => {
    const sprite = document.querySelector(".dance__spin-sprite");
    const style = window.getComputedStyle(sprite);
    return {
      progress: document.querySelector("[data-current-count]")?.textContent,
      opacity: style.opacity,
      backgroundImage: style.backgroundImage,
      backgroundSize: style.backgroundSize,
      backgroundPosition: style.backgroundPosition,
      transform: style.transform,
    };
  });

  console.log(JSON.stringify({ info, frames }, null, 2));
})
