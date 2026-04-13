import { test, expect } from '@playwright/test';

test.describe('Advanced Settings Flow - Multiple Items & Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should add multiple agent roles and persist all', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '👥 Agents' }).click();
    await page.getByRole('button', { name: 'Add Role' }).click();
    await page.getByRole('button', { name: 'Add Role' }).click();
    await page.getByRole('button', { name: 'Add Role' }).click();

    await expect(page.getByText('Role #1')).toBeVisible();
    await expect(page.getByText('Role #2')).toBeVisible();
    await expect(page.getByText('Role #3')).toBeVisible();

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '👥 Agents' }).click();
    await expect(page.getByText('Role #1')).toBeVisible();
    await expect(page.getByText('Role #2')).toBeVisible();
    await expect(page.getByText('Role #3')).toBeVisible();
  });

  test('should remove middle item from list', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '👥 Agents' }).click();
    await page.getByRole('button', { name: 'Add Role' }).click();
    await page.getByRole('button', { name: 'Add Role' }).click();

    await expect(page.getByText('Role #1')).toBeVisible();
    await expect(page.getByText('Role #2')).toBeVisible();

    const removeButtons = page.locator('button[aria-label="Remove role"]');
    await removeButtons.first().click();

    await expect(page.getByText('Role #1')).toBeVisible();
  });

  test('should add multiple MCP servers and tools', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🔧 MCP & Tools' }).click();

    await page.getByRole('button', { name: 'Add Server' }).click();
    await page.getByRole('button', { name: 'Add Server' }).click();

    const serverNameInputs = page.getByPlaceholder('Server name');
    await expect(serverNameInputs).toHaveCount(2);

    await page.getByRole('button', { name: 'Add Tool' }).click();
    await page.getByRole('button', { name: 'Add Tool' }).click();

    const toolNameInputs = page.getByPlaceholder('Tool name');
    await expect(toolNameInputs).toHaveCount(2);
  });

  test('should add multiple remote computers', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🖥️ Remote & SSH' }).click();
    await page.getByRole('button', { name: 'Add Computer' }).click();
    await page.getByRole('button', { name: 'Add Computer' }).click();

    const nameInputs = page.getByPlaceholder('My Server');
    await expect(nameInputs).toHaveCount(2);

    await nameInputs.first().fill('Server A');
    await nameInputs.nth(1).fill('Server B');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '🖥️ Remote & SSH' }).click();
    await expect(page.getByPlaceholder('My Server').first()).toHaveValue('Server A');
  });

  test('should add multiple relay servers', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🌐 P2P Network' }).click();
    await page.getByRole('button', { name: 'Add Relay Server' }).click();
    await page.getByRole('button', { name: 'Add Relay Server' }).click();

    const relayInputs = page.getByPlaceholder('wss://relay.example.com');
    await expect(relayInputs).toHaveCount(2);

    await relayInputs.first().fill('wss://relay1.example.com');
    await relayInputs.nth(1).fill('wss://relay2.example.com');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '🌐 P2P Network' }).click();
    await expect(page.getByPlaceholder('wss://relay.example.com').first()).toHaveValue('wss://relay1.example.com');
  });

  test('should add multiple environment variables', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '📁 Project' }).click();
    await page.getByRole('button', { name: 'Add Variable' }).click();
    await page.getByRole('button', { name: 'Add Variable' }).click();

    const keyInputs = page.getByPlaceholder('KEY');
    await expect(keyInputs).toHaveCount(2);

    const valueInputs = page.getByPlaceholder('value');
    await expect(valueInputs).toHaveCount(2);
  });

  test('should edit RAG settings and persist', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '📚 RAG & Knowledge' }).click();

    const checkbox = page.locator('input#rag-enabled');
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '📚 RAG & Knowledge' }).click();
    await expect(page.locator('input#rag-enabled')).toBeChecked();
  });

  test('should edit P2P settings and persist', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🌐 P2P Network' }).click();

    const checkbox = page.locator('input#p2p-enabled');
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }

    await page.locator('select#p2p-discovery').selectOption('dht');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '🌐 P2P Network' }).click();
    await expect(page.locator('input#p2p-enabled')).toBeChecked();
    await expect(page.locator('select#p2p-discovery')).toHaveValue('dht');
  });

  test('should edit UI settings and persist', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🎨 UI/UX' }).click();

    await page.locator('select#ui-font').selectOption('jetbrains');
    await page.locator('select#ui-language').selectOption('zh');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '🎨 UI/UX' }).click();
    await expect(page.locator('select#ui-font')).toHaveValue('jetbrains');
    await expect(page.locator('select#ui-language')).toHaveValue('zh');
  });

  test('should edit project settings and persist', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '📁 Project' }).click();

    await page.locator('input#proj-workdir').fill('/home/user/myproject');
    await page.locator('select#proj-branch').selectOption('trunk-based');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '📁 Project' }).click();
    await expect(page.locator('input#proj-workdir')).toHaveValue('/home/user/myproject');
    await expect(page.locator('select#proj-branch')).toHaveValue('trunk-based');
  });

  test('should edit agent collaboration and conflict settings', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '👥 Agents' }).click();

    await page.locator('select#agent-collab').selectOption('parallel');
    await page.locator('select#agent-conflict').selectOption('vote');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '👥 Agents' }).click();
    await expect(page.locator('select#agent-collab')).toHaveValue('parallel');
    await expect(page.locator('select#agent-conflict')).toHaveValue('vote');
  });

  test('should handle checkbox toggles in memory settings', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🧠 Memory' }).click();

    const summaryCheckbox = page.locator('input#summary-compression');
    const originalState = await summaryCheckbox.isChecked();
    await summaryCheckbox.click();

    const fileWatchCheckbox = page.locator('input#file-watching');
    await fileWatchCheckbox.click();

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '🧠 Memory' }).click();
    await expect(page.locator('input#summary-compression')).toBeChecked({ checked: !originalState });
  });

  test('should handle checkbox toggles in deployment settings', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🖥️ Remote & SSH' }).click();

    const autoUpdateCheckbox = page.locator('input#auto-update');
    await autoUpdateCheckbox.check();

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '🖥️ Remote & SSH' }).click();
    await expect(page.locator('input#auto-update')).toBeChecked();
  });

  test('should save settings with warnings for empty required fields', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🖥️ Remote & SSH' }).click();
    await page.getByRole('button', { name: 'Add Computer' }).click();

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText(/Settings saved.*warning/)).toBeVisible({ timeout: 5000 });
  });
});
