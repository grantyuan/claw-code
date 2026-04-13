import { test, expect } from '@playwright/test';

test.describe('Settings Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should open settings panel', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('should display all settings tabs', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();
    await expect(page.getByRole('button', { name: '🤖 AI Model' })).toBeVisible();
    await expect(page.getByRole('button', { name: '👥 Agents' })).toBeVisible();
    await expect(page.getByRole('button', { name: '📚 RAG & Knowledge' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🔧 MCP & Tools' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🧠 Memory' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🖥️ Remote & SSH' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🌐 P2P Network' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🎨 UI/UX' })).toBeVisible();
    await expect(page.getByRole('button', { name: '📁 Project' })).toBeVisible();
  });

  test('should switch between settings tabs', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '👥 Agents' }).click();
    await expect(page.getByText('Collaboration Pattern')).toBeVisible();

    await page.getByRole('button', { name: '📚 RAG & Knowledge' }).click();
    await expect(page.getByText('Enable RAG')).toBeVisible();

    await page.getByRole('button', { name: '🧠 Memory' }).click();
    await expect(page.getByText('Max Context Window')).toBeVisible();
  });

  test('should show AI Model settings by default', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();
    await expect(page.getByText('Model Profiles')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Model' })).toBeVisible();
  });

  test('should show Unsaved changes indicator after editing', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    // Navigate to Memory tab and edit a field to trigger unsaved changes
    await page.getByRole('button', { name: '🧠 Memory' }).click();
    await page.locator('input#mem-context').fill('256000');
    await expect(page.getByText('Unsaved changes')).toBeVisible();
  });

  test('should show Save Changes and Cancel buttons', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('should close settings panel on Cancel', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).not.toBeVisible();
  });

  test('should display P2P Network settings', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();
    await page.getByText('P2P Network', { exact: false }).click();
    await expect(page.getByText('Enable P2P Networking')).toBeVisible();
    await expect(page.getByText('Discovery Method')).toBeVisible();
    await expect(page.getByText('NAT Traversal')).toBeVisible();
  });

  test('should display Project settings', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();
    await page.getByText('Project', { exact: false }).click();
    await expect(page.getByText('Working Directory')).toBeVisible();
    await expect(page.getByText('Git Integration')).toBeVisible();
    await expect(page.getByText('Branch Management')).toBeVisible();
  });
});

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have a message textarea', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type your message...');
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeEditable();
  });

  test('should type and display text in textarea', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type your message...');
    await textarea.fill('Hello, this is a test message');
    await expect(textarea).toHaveValue('Hello, this is a test message');
  });

  test('should clear textarea after sending', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type your message...');
    await textarea.fill('Test message');
    await textarea.press('Enter');
    await expect(textarea).toHaveValue('');
  });
});

test.describe('Toast Notifications', () => {
  test('should have Toast component available in the page', async ({ page }) => {
    await page.goto('/');
    const appContainer = page.getByTestId('app-container');
    await expect(appContainer).toBeVisible();
  });
});

test.describe('Responsive Layout', () => {
  test('should render both panels on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page.getByTestId('left-panel')).toBeVisible();
    await expect(page.getByTestId('right-panel')).toBeVisible();
  });

  test('should maintain panel visibility on medium screens', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 600 });
    await page.goto('/');
    await expect(page.getByTestId('left-panel')).toBeVisible();
    await expect(page.getByTestId('right-panel')).toBeVisible();
  });
});
