import path from "path";
import { fileURLToPath } from "url";
import { test, expect, _electron as electron } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const vaultPath = path.resolve(__dirname, "../../vault");

test("Obsidian should open", async () => {
  const vaultPath = path.resolve(__dirname, "../../vault");

  // Launch Obsidian as Electron app
  const app = await electron.launch({ args: [vaultPath] });

  // Get the first window
  const window = await app.firstWindow();

  expect(window).toBeTruthy();
  await expect(window).toHaveTitle(/Obsidian/);

  // Close Obsidian
  await app.close();
});
