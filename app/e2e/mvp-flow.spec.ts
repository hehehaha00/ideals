// 这个文件用浏览器验证用户能走完整个 MVP 脑洞流程。
import { expect, test } from "@playwright/test";

test("user can complete the MVP creativity flow", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("主题").fill("我想做一个有趣的开发者工具");
  await page.getByRole("button", { name: "开始发散" }).click();

  await expect(page.getByText("维度词")).toBeVisible();
  await expect(page.getByRole("button", { name: "把这些词撞一下" })).toBeEnabled();

  await page.getByRole("button", { name: "锁定词" }).first().click();
  await page.getByRole("button", { name: "换一批刺激" }).click();
  await page.getByRole("button", { name: "随机组合" }).click();
  await page.getByRole("button", { name: "把这些词撞一下" }).click();

  await expect(page.getByRole("heading", { name: "脑洞卡片" })).toBeVisible();

  await page.getByRole("button", { name: "选中" }).first().click();
  await page.getByRole("button", { name: "更游戏化一点" }).click();
  await expect(page.locator("article").filter({ hasText: "· 更游戏化一点" }).first()).toBeVisible();

  const favoritedTitle = await page.locator("article h3").first().innerText();
  await page.getByRole("button", { name: "收藏" }).first().click();
  await expect(page.getByText("已收藏")).toBeVisible();

  await page.reload();
  await expect(page.getByText("孵化箱")).toBeVisible();
  await expect(page.getByText(favoritedTitle)).toBeVisible();
});
