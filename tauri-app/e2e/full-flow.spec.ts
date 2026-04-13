import { test, expect } from '@playwright/test';

test.describe('Full Settings Flow - Edit, Save, Persist', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should edit and save AI model settings', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    // Add a new model profile
    await page.getByRole('button', { name: 'Add Model' }).click();

    // Wait for the edit form to appear (it has the Name input)
    await expect(page.locator('input[placeholder="My Model"]')).toBeVisible({ timeout: 5000 });

    // Fill in model details using custom provider (text input for model name)
    await page.locator('input[placeholder="My Model"]').fill('Test Custom Model');

    // Select Custom provider (ensures model field is a text input)
    await page.locator('select').filter({ has: page.locator('option[value="custom"]') }).first().selectOption('custom');
    await page.locator('input[placeholder="model-name"]').fill('my-custom-model');

    // Save the profile by clicking the Save button inside the edit form
    const editForm = page.locator('.p-4.rounded-lg.border').filter({ has: page.locator('input[placeholder="My Model"]') });
    await editForm.getByRole('button', { name: 'Save' }).click();

    // Now save all settings
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    // Close the settings panel
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Verify config was persisted in localStorage
    const storedConfig = await page.evaluate(() => {
      const raw = localStorage.getItem('clawcode-config');
      return raw ? JSON.parse(raw) : null;
    });
    expect(storedConfig).toBeTruthy();
    expect(storedConfig.modelProfiles.length).toBeGreaterThan(0);
  });

  test('should add agent role, edit fields, save and persist', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '👥 Agents' }).click();
    await page.getByRole('button', { name: 'Add Role' }).click();

    await expect(page.getByText('Role #1')).toBeVisible();

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '👥 Agents' }).click();
    await expect(page.getByText('Role #1')).toBeVisible();
  });

  test('should add and remove agent role', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '👥 Agents' }).click();
    await page.getByRole('button', { name: 'Add Role' }).click();
    await expect(page.getByText('Role #1')).toBeVisible();

    await page.locator('button[aria-label="Remove role"]').click();
    await expect(page.getByText('No agent roles configured')).toBeVisible();
  });

  test('should add repository with editable fields, save and persist', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '📚 RAG & Knowledge' }).click();
    await page.getByRole('button', { name: 'Add Repository' }).click();

    const nameInput = page.getByPlaceholder('Repository name');
    await nameInput.fill('My Docs');
    const pathInput = page.getByPlaceholder('/path/to/repo');
    await pathInput.fill('/home/user/docs');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '📚 RAG & Knowledge' }).click();
    await expect(page.getByPlaceholder('Repository name')).toHaveValue('My Docs');
    await expect(page.getByPlaceholder('/path/to/repo')).toHaveValue('/home/user/docs');
  });

  test('should add and remove repository', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '📚 RAG & Knowledge' }).click();
    await page.getByRole('button', { name: 'Add Repository' }).click();
    await expect(page.getByPlaceholder('Repository name')).toBeVisible();

    await page.locator('button[aria-label="Remove repository"]').click();
    await expect(page.getByText('No repositories configured')).toBeVisible();
  });

  test('should add MCP server, edit, save and persist', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🔧 MCP & Tools' }).click();
    await page.getByRole('button', { name: 'Add Server' }).click();

    await page.getByPlaceholder('Server name').fill('My MCP');
    await page.getByPlaceholder('http://localhost:3000').fill('http://mcp.example.com:8080');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '🔧 MCP & Tools' }).click();
    await expect(page.getByPlaceholder('Server name')).toHaveValue('My MCP');
    await expect(page.getByPlaceholder('http://localhost:3000')).toHaveValue('http://mcp.example.com:8080');
  });

  test('should add and remove MCP server', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🔧 MCP & Tools' }).click();
    await page.getByRole('button', { name: 'Add Server' }).click();
    await expect(page.getByPlaceholder('Server name')).toBeVisible();

    await page.locator('button[aria-label="Remove server"]').click();
    await expect(page.getByText('No MCP servers configured')).toBeVisible();
  });

  test('should add tool, edit, save and persist', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🔧 MCP & Tools' }).click();
    await page.getByRole('button', { name: 'Add Tool' }).click();

    await page.getByPlaceholder('Tool name').fill('File Search');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '🔧 MCP & Tools' }).click();
    await expect(page.getByPlaceholder('Tool name')).toHaveValue('File Search');
  });

  test('should add remote computer, edit fields, save and persist', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🖥️ Remote & SSH' }).click();
    await page.getByRole('button', { name: 'Add Computer' }).click();

    await page.getByPlaceholder('My Server').fill('Dev Server');
    await page.getByPlaceholder('192.168.1.100').fill('10.0.0.5');
    await page.getByPlaceholder('user').fill('admin');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '🖥️ Remote & SSH' }).click();
    await expect(page.getByPlaceholder('My Server')).toHaveValue('Dev Server');
    await expect(page.getByPlaceholder('192.168.1.100')).toHaveValue('10.0.0.5');
    await expect(page.getByPlaceholder('user')).toHaveValue('admin');
  });

  test('should add and remove remote computer', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🖥️ Remote & SSH' }).click();
    await page.getByRole('button', { name: 'Add Computer' }).click();
    await expect(page.getByPlaceholder('My Server')).toBeVisible();

    await page.locator('button[aria-label="Remove computer"]').click();
    await expect(page.getByText('No remote computers configured')).toBeVisible();
  });

  test('should add relay server, edit URL, save and persist', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🌐 P2P Network' }).click();
    await page.getByRole('button', { name: 'Add Relay Server' }).click();

    await page.getByPlaceholder('wss://relay.example.com').fill('wss://my-relay.example.com');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '🌐 P2P Network' }).click();
    await expect(page.getByPlaceholder('wss://relay.example.com')).toHaveValue('wss://my-relay.example.com');
  });

  test('should add and remove relay server', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🌐 P2P Network' }).click();
    await page.getByRole('button', { name: 'Add Relay Server' }).click();
    await expect(page.getByPlaceholder('wss://relay.example.com')).toBeVisible();

    await page.locator('button[aria-label="Remove relay server"]').click();
    await expect(page.getByText('No relay servers configured')).toBeVisible();
  });

  test('should add env variable, edit key/value, save and persist', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '📁 Project' }).click();
    await page.getByRole('button', { name: 'Add Variable' }).click();

    const keyInput = page.getByPlaceholder('KEY');
    await keyInput.clear();
    await keyInput.fill('DATABASE_URL');
    const valueInput = page.getByPlaceholder('value');
    await valueInput.fill('postgres://localhost:5432/mydb');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '📁 Project' }).click();
    await expect(page.getByPlaceholder('KEY')).toHaveValue('DATABASE_URL');
    await expect(page.getByPlaceholder('value')).toHaveValue('postgres://localhost:5432/mydb');
  });

  test('should add and remove env variable', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '📁 Project' }).click();
    await page.getByRole('button', { name: 'Add Variable' }).click();
    await expect(page.getByPlaceholder('KEY')).toBeVisible();

    await page.locator('button[aria-label="Remove variable"]').click();
    await expect(page.getByText('No environment variables configured')).toBeVisible();
  });

  test('should edit memory settings and persist', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🧠 Memory' }).click();

    await page.locator('input#mem-context').fill('256000');
    await page.locator('input#mem-retention').fill('60');
    await page.locator('input#mem-workdir').fill('/home/user/project');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '🧠 Memory' }).click();
    await expect(page.locator('input#mem-context')).toHaveValue('256000');
    await expect(page.locator('input#mem-retention')).toHaveValue('60');
    await expect(page.locator('input#mem-workdir')).toHaveValue('/home/user/project');
  });

  test('should edit deployment settings and persist', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🖥️ Remote & SSH' }).click();

    await page.locator('input#deploy-path').fill('/usr/local/clawcode');
    await page.locator('input#deploy-version').fill('0.2.0');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '🖥️ Remote & SSH' }).click();
    await expect(page.locator('input#deploy-path')).toHaveValue('/usr/local/clawcode');
    await expect(page.locator('input#deploy-version')).toHaveValue('0.2.0');
  });

  test('should cancel discards unsaved changes', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    // Navigate to Memory tab and edit
    await page.getByRole('button', { name: '🧠 Memory' }).click();
    await page.locator('input#mem-context').fill('999999');
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '🧠 Memory' }).click();
    await expect(page.locator('input#mem-context')).not.toHaveValue('999999');
  });

  test('should show Unsaved changes indicator when editing', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await expect(page.getByText('Unsaved changes')).not.toBeVisible();

    // Navigate to Memory tab and edit
    await page.getByRole('button', { name: '🧠 Memory' }).click();
    await page.locator('input#mem-context').fill('256000');
    await expect(page.getByText('Unsaved changes')).toBeVisible();
  });

  test('should persist theme change to localStorage', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🎨 UI/UX' }).click();
    await page.locator('select#ui-theme').selectOption('light');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    const storedConfig = await page.evaluate(() => {
      const raw = localStorage.getItem('clawcode-config');
      return raw ? JSON.parse(raw) : null;
    });
    expect(storedConfig.ui.theme).toBe('light');
  });
});
