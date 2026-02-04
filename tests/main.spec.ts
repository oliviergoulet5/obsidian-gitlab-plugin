import path from "path";
import { fileURLToPath } from "url";
import process from "node:process";
import { test, expect, _electron as electron } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const vaultPath = path.resolve(__dirname, "../../vault");

test("Obsidian should open", async () => {
  const vaultPath = path.resolve(__dirname, "../../vault");

  // Launch Obsidian as Electron app
  const app = await electron.launch({ 
    executablePath: process.env.OBSIDIAN_PATH,
    args: [vaultPath] 
  });

  // Get the first window
  const window = await app.firstWindow();

  expect(window).toBeTruthy();
  await expect(window).toHaveTitle(/Obsidian/);

  // Close Obsidian
  await app.close();
});
