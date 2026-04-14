import { test, expect } from '@playwright/test';

async function closeAnyModal(page: any) {
  const modal = page.locator('.fixed.inset-0.z-50').first();
  if (await modal.isVisible().catch(() => false)) {
    const closeButton = page.locator('button[title="Close"], button[aria-label="Close"], .fixed.inset-0 button').first();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
      await page.waitForTimeout(300);
    }
  }
}

test.describe('AI Model Settings E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await closeAnyModal(page);
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();
    await page.getByRole('button', { name: '🤖 AI Model' }).click();
  });

  test('should display AI Model Configuration header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'AI Model Configuration' })).toBeVisible();
  });

  test('should display Default Provider selector', async ({ page }) => {
    await expect(page.getByText('Default Provider')).toBeVisible();
    const selector = page.locator('select').first();
    await expect(selector).toBeVisible();
  });

  test('should display Providers section', async ({ page }) => {
    await expect(page.getByText('Providers', { exact: true })).toBeVisible();
  });

  test('should NOT have "Add Provider" button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Add Provider' })).not.toBeVisible();
  });

  test('should display ranked models section', async ({ page }) => {
    await expect(page.getByText('All Models (Ranked)')).toBeVisible();
    await expect(page.getByText(/Models are ranked by capability/)).toBeVisible();
  });

  test('should show empty state when no providers configured', async ({ page }) => {
    await expect(page.getByText('No providers configured. Please add a provider.')).toBeVisible();
  });
});

test.describe('AI Model Settings with Providers E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await closeAnyModal(page);

    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();
    await page.getByRole('button', { name: '🤖 AI Model' }).click();

    await page.waitForTimeout(500);
  });

  test('should show provider type options when providers exist', async ({ page }) => {
    const providerCard = page.locator('.p-4.rounded-lg.border').first();
    const hasProviders = await providerCard.isVisible().catch(() => false);

    if (hasProviders) {
      const providerTypeSelect = page.locator('select').nth(1);
      await providerTypeSelect.click();

      await expect(page.getBy_role('option', { name: 'Anthropic' })).toBeVisible();
      await expect(page.getBy_role('option', { name: 'OpenAI' })).toBeVisible();
      await expect(page.getBy_role('option', { name: 'Ollama' })).toBeVisible();
      await expect(page.getBy_role('option', { name: 'Other Protocol' })).toBeVisible();
    } else {
      test.skip(true, 'No providers configured in this environment');
    }
  });

  test('should display API Endpoint field when providers exist', async ({ page }) => {
    const providerCard = page.locator('.p-4.rounded-lg.border').first();
    const hasProviders = await providerCard.isVisible().catch(() => false);

    if (hasProviders) {
      await expect(page.getByText('API Endpoint')).toBeVisible();
      const endpointInput = page.locator('input[type="url"]').first();
      await expect(endpointInput).toBeVisible();
    } else {
      test.skip(true, 'No providers configured in this environment');
    }
  });

  test('should display API Key field when providers exist', async ({ page }) => {
    const providerCard = page.locator('.p-4.rounded-lg.border').first();
    const hasProviders = await providerCard.isVisible().catch(() => false);

    if (hasProviders) {
      await expect(page.getByText('API Key')).toBeVisible();
      const apiKeyInput = page.locator('input[type="password"]').first();
      await expect(apiKeyInput).toBeVisible();
    } else {
      test.skip(true, 'No providers configured in this environment');
    }
  });

  test('should display Add Preset and Add Custom buttons for models when providers exist', async ({ page }) => {
    const providerCard = page.locator('.p-4.rounded-lg.border').first();
    const hasProviders = await providerCard.isVisible().catch(() => false);

    if (hasProviders) {
      await expect(page.getByRole('button', { name: 'Add Preset' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Custom' })).toBeVisible();
    } else {
      test.skip(true, 'No providers configured in this environment');
    }
  });

  test('should display Delete button when providers exist', async ({ page }) => {
    const providerCard = page.locator('.p-4.rounded-lg.border').first();
    const hasProviders = await providerCard.isVisible().catch(() => false);

    if (hasProviders) {
      await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
    } else {
      test.skip(true, 'No providers configured in this environment');
    }
  });

  test('should switch provider type and auto-fill endpoint when providers exist', async ({ page }) => {
    const providerCard = page.locator('.p-4.rounded-lg.border').first();
    const hasProviders = await providerCard.isVisible().catch(() => false);

    if (hasProviders) {
      const providerTypeSelect = page.locator('select').nth(1);
      const endpointInput = page.locator('input[type="url"]').first();

      await providerTypeSelect.selectOption('ollama');
      await expect(endpointInput).toHaveValue('http://localhost:11434/v1');

      await providerTypeSelect.selectOption('anthropic');
      await expect(endpointInput).toHaveValue('https://api.anthropic.com');

      await providerTypeSelect.selectOption('openai');
      await expect(endpointInput).toHaveValue('https://api.openai.com/v1');
    } else {
      test.skip(true, 'No providers configured in this environment');
    }
  });

  test('should show model rank badges when models exist', async ({ page }) => {
    const rankBadge = page.locator('.px-2.py-1.rounded.text-sm.font-bold').first();
    const hasModels = await rankBadge.isVisible().catch(() => false);

    if (hasModels) {
      await expect(page.getByText('#1')).toBeVisible();
    } else {
      test.skip(true, 'No models configured in this environment');
    }
  });

  test('should show Save Changes button when changes are made', async ({ page }) => {
    const providerCard = page.locator('.p-4.rounded-lg.border').first();
    const hasProviders = await providerCard.isVisible().catch(() => false);

    if (hasProviders) {
      const nameInput = page.locator('input[type="text"]').first();
      await nameInput.fill('Modified Provider');

      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
    } else {
      test.skip(true, 'No providers configured in this environment');
    }
  });
});
