import { test, expect, _electron as electron } from "@playwright/test";
import path from "path";

const vaultPath = path.resolve(__dirname, "../../vault");

test("Obsidian should open", async () => {
  const vaultPath = path.resolve(__dirname, "../../vault");

  // Launch Obsidian as Electron app
  const app = await electron.launch({ args: [vaultPath] });

  // Get the first window
  const window = await app.firstWindow();

  // Assert the window exists and is visible
  expect(await window.isVisible()).toBeTruthy();

  // Close Obsidian
  await app.close();
});
