import { test, expect } from '@playwright/test';

test.describe('Application Shell', () => {
  test('should load the application with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ClawCode/);
  });

  test('should render the split-panel layout', async ({ page }) => {
    await page.goto('/');
    const leftPanel = page.getByTestId('left-panel');
    const rightPanel = page.getByTestId('right-panel');
    await expect(leftPanel).toBeVisible();
    await expect(rightPanel).toBeVisible();
  });

  test('should display the app container', async ({ page }) => {
    await page.goto('/');
    const appContainer = page.getByTestId('app-container');
    await expect(appContainer).toBeVisible();
  });
});

test.describe('Chat Panel', () => {
  test('should display chat panel header', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Claw Chat')).toBeVisible();
  });

  test('should display empty state message', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Start a conversation with the Leader Agent')).toBeVisible();
  });

  test('should have a message input field', async ({ page }) => {
    await page.goto('/');
    const textarea = page.getByPlaceholder('Type your message...');
    await expect(textarea).toBeVisible();
  });

  test('should have a send button', async ({ page }) => {
    await page.goto('/');
    const sendButton = page.locator('button:has(svg path[d*="M12 19l9 2-9-18"])');
    await expect(sendButton).toBeVisible();
  });

  test('should type in the message input', async ({ page }) => {
    await page.goto('/');
    const textarea = page.getByPlaceholder('Type your message...');
    await textarea.fill('Hello, ClawCode!');
    await expect(textarea).toHaveValue('Hello, ClawCode!');
  });

  test('should show settings button in chat panel', async ({ page }) => {
    await page.goto('/');
    const settingsButton = page.locator('button[title="Settings"]');
    await expect(settingsButton).toBeVisible();
  });
});

test.describe('Agent Dashboard', () => {
  test('should show leader agent section', async ({ page }) => {
    await page.goto('/');
    const leaderSection = page.locator('span.text-sm.font-medium').filter({ hasText: 'Leader Agent' });
    await expect(leaderSection).toBeVisible();
  });

  test('should display agent status', async ({ page }) => {
    await page.goto('/');
    const statusElement = page.locator('[data-testid="right-panel"]').locator('span').filter({ hasText: /idle|active|thinking|error|offline/ }).first();
    await expect(statusElement).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Theme', () => {
  test('should apply dark theme by default', async ({ page }) => {
    await page.goto('/');
    const appContainer = page.getByTestId('app-container');
    await expect(appContainer).toHaveClass(/dark/);
  });

  test('should have CSS custom properties for theming', async ({ page }) => {
    await page.goto('/');
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-bg');
    });
    expect(bgColor).toBeTruthy();
  });
});
