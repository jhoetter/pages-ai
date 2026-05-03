import { expect, test } from "@playwright/test";

test("home loads", async ({ page }) => {
  await page.goto("/pages");
  await expect(page.getByRole("heading", { name: "PagesAI" })).toBeVisible();
  await expect(page.getByTestId("pages-library-heading")).toBeVisible();
});

test("database route loads", async ({ page }) => {
  await page.goto("/pages/db/example-db");
  await expect(page.getByRole("heading")).toBeVisible();
});

test("create page keeps session after refresh", async ({ page }) => {
  await page.goto("/pages");
  await page.getByTestId("library-new-page").click();
  await page.waitForURL(/\/pages\/p\/[0-9a-f-]{36}/i);
  const url = page.url();
  await page.reload();
  await expect(page).toHaveURL(url);
});

test("command palette opens with ctrl+k", async ({ page }) => {
  await page.goto("/pages");
  await page.getByTestId("library-new-page").click();
  await page.waitForURL(/\/pages\/p\/[0-9a-f-]{36}/i);
  await page.locator("body").click({ position: { x: 8, y: 8 } });
  /** Cmd+K is bound in PageEditor only; Ctrl+K avoids Chromium stealing Meta+K. */
  await page.keyboard.press("Control+KeyK");
  await expect(page.getByTestId("command-palette")).toBeVisible();
});

test("editor page shows document canvas", async ({ page }) => {
  await page.goto("/pages");
  await page.getByTestId("library-new-page").click();
  await page.waitForURL(/\/pages\/p\/[0-9a-f-]{36}/i);
  await expect(page.getByTestId("document-canvas")).toBeVisible();
});

test("add block menu lists block types", async ({ page }) => {
  await page.goto("/pages");
  await page.getByTestId("library-new-page").click();
  await page.waitForURL(/\/pages\/p\/[0-9a-f-]{36}/i);
  await page.getByTestId("add-block-trigger").click();
  await expect(page.getByRole("button", { name: "Text", exact: true })).toBeVisible();
});
