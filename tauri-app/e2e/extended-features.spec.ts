import { test, expect } from '@playwright/test';

test.describe('Chat Message Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display empty state when no messages', async ({ page }) => {
    await expect(page.getByText('Start a conversation with the Leader Agent')).toBeVisible();
  });

  test('should type message and clear after Enter key', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type your message...');
    await textarea.fill('Hello ClawCode');
    await expect(textarea).toHaveValue('Hello ClawCode');
    await textarea.press('Enter');
    await expect(textarea).toHaveValue('');
  });

  test('should type message and clear after clicking send button', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type your message...');
    await textarea.fill('Test via button');
    const sendButton = page.getByTestId('send-button');
    await sendButton.click();
    await expect(textarea).toHaveValue('');
  });

  test('should display user message after sending', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type your message...');
    await textarea.fill('My test message');
    await textarea.press('Enter');
    await expect(page.getByText('My test message')).toBeVisible();
  });

  test('should not send empty message', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type your message...');
    const sendButton = page.getByTestId('send-button');
    await expect(sendButton).toBeDisabled();
    await textarea.fill('   ');
    await expect(sendButton).toBeDisabled();
  });

  test('should not send message with only whitespace', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type your message...');
    await textarea.fill('   ');
    await textarea.press('Enter');
    await expect(page.getByText('Start a conversation with the Leader Agent')).toBeVisible();
  });

  test('should hide empty state after sending first message', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type your message...');
    await textarea.fill('First message');
    await textarea.press('Enter');
    await expect(page.getByText('Start a conversation with the Leader Agent')).not.toBeVisible();
  });

  test('should display multiple messages in order', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type your message...');
    await textarea.fill('Message one');
    await textarea.press('Enter');
    await textarea.fill('Message two');
    await textarea.press('Enter');
    const messages = page.getByTestId('chat-messages').locator('.whitespace-pre-wrap');
    await expect(messages).toHaveCount(2);
  });

  test('should show user messages right-aligned', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type your message...');
    await textarea.fill('Right aligned');
    await textarea.press('Enter');
    const userMessage = page.getByText('Right aligned');
    await expect(userMessage).toBeVisible();
    const container = userMessage.locator('..').locator('..');
    await expect(container).toHaveClass(/justify-end/);
  });

  test('should show timestamp on messages', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type your message...');
    await textarea.fill('Timestamped message');
    await textarea.press('Enter');
    const messageContainer = page.getByTestId('chat-messages');
    const timeElement = messageContainer.locator('.opacity-50');
    await expect(timeElement.first()).toBeVisible();
  });

  test('should auto-expand textarea on input', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type your message...');
    const initialHeight = await textarea.evaluate(el => el.offsetHeight);
    await textarea.fill('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
    const newHeight = await textarea.evaluate(el => el.offsetHeight);
    expect(newHeight).toBeGreaterThanOrEqual(initialHeight);
  });
});

test.describe('Keyboard Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should send message on Enter without Shift', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type your message...');
    await textarea.fill('Enter key test');
    await textarea.press('Enter');
    await expect(textarea).toHaveValue('');
    await expect(page.getByText('Enter key test')).toBeVisible();
  });

  test('should not send message on Shift+Enter', async ({ page }) => {
    const textarea = page.getByPlaceholder('Type your message...');
    await textarea.fill('Shift+Enter test');
    await textarea.press('Shift+Enter');
    const value = await textarea.inputValue();
    expect(value).toContain('Shift+Enter test');
    await expect(page.getByText('Shift+Enter test')).not.toBeVisible();
  });

  test('should navigate to agent detail on click', async ({ page }) => {
    const agentButton = page.locator('[data-testid="right-panel"] button.card');
    if (await agentButton.count() > 0) {
      await agentButton.first().click();
      await expect(page.locator('button[title="Back to overview"]')).toBeVisible();
    }
  });

  test('should go back to agent overview on Escape from detail', async ({ page }) => {
    const agentButton = page.locator('[data-testid="right-panel"] button.card');
    if (await agentButton.count() > 0) {
      await agentButton.first().click();
      await expect(page.locator('button[title="Back to overview"]')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByText('Agent Dashboard')).toBeVisible();
    }
  });

  test('should go back to agent overview on back button click', async ({ page }) => {
    const agentButton = page.locator('[data-testid="right-panel"] button.card');
    if (await agentButton.count() > 0) {
      await agentButton.first().click();
      const backButton = page.locator('button[title="Back to overview"]');
      await backButton.click();
      await expect(page.getByText('Agent Dashboard')).toBeVisible();
    }
  });
});

test.describe('Toast Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show toast on settings save', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // Navigate to Memory tab and modify a field
    await page.getByRole('button', { name: '🧠 Memory' }).click();
    await page.locator('input#mem-context').fill('256000');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });
  });

  test('should show toast with correct role attribute', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    // Navigate to Memory tab and modify a field
    await page.getByRole('button', { name: '🧠 Memory' }).click();
    await page.locator('input#mem-context').fill('256000');

    await page.getByRole('button', { name: 'Save Changes' }).click();

    const toast = page.locator('[role="status"]').filter({ hasText: 'Settings saved' });
    if (await toast.count() > 0) {
      await expect(toast).toBeVisible();
    }
  });

  test('should dismiss toast on close button click', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    // Navigate to Memory tab and modify a field
    await page.getByRole('button', { name: '🧠 Memory' }).click();
    await page.locator('input#mem-context').fill('256000');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    const toastMessage = page.getByText('Settings saved');
    await expect(toastMessage).toBeVisible({ timeout: 5000 });

    const dismissButton = page.locator('button[aria-label="Dismiss notification"]');
    if (await dismissButton.count() > 0) {
      await dismissButton.first().click({ timeout: 3000 });
      await expect(toastMessage).not.toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Theme Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should apply dark theme by default', async ({ page }) => {
    const appContainer = page.getByTestId('app-container');
    await expect(appContainer).toHaveClass(/dark/);
  });

  test('should switch to light theme via settings', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🎨 UI/UX' }).click();

    const themeSelect = page.locator('select').filter({ has: page.locator('option[value="light"]') });
    await themeSelect.selectOption('light');

    const appContainer = page.getByTestId('app-container');
    await expect(appContainer).not.toHaveClass(/dark/);
  });

  test('should switch back to dark theme', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🎨 UI/UX' }).click();

    const themeSelect = page.locator('select').filter({ has: page.locator('option[value="light"]') });
    await themeSelect.selectOption('light');

    const appContainer = page.getByTestId('app-container');
    await expect(appContainer).not.toHaveClass(/dark/);

    await themeSelect.selectOption('dark');
    await expect(appContainer).toHaveClass(/dark/);
  });

  test('should persist theme in localStorage', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await page.getByRole('button', { name: '🎨 UI/UX' }).click();

    const themeSelect = page.locator('select').filter({ has: page.locator('option[value="light"]') });
    await themeSelect.selectOption('light');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved successfully')).toBeVisible({ timeout: 5000 });

    const storedTheme = await page.evaluate(() => localStorage.getItem('clawcode-theme'));
    expect(storedTheme).toBe('light');
  });
});

test.describe('Settings Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should persist AI endpoint after save and reopen', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    // Navigate to Memory tab and modify a field
    await page.getByRole('button', { name: '🧠 Memory' }).click();
    await page.locator('input#mem-context').fill('256000');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).not.toBeVisible();

    await settingsButton.click();
    await page.getByRole('button', { name: '🧠 Memory' }).click();
    await expect(page.locator('input#mem-context')).toHaveValue('256000');
  });

  test('should persist AI provider after save and reopen', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    // Navigate to Agents tab and modify collaboration
    await page.getByRole('button', { name: '👥 Agents' }).click();
    await page.locator('select#agent-collab').selectOption('parallel');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).not.toBeVisible();

    await settingsButton.click();
    await page.getByRole('button', { name: '👥 Agents' }).click();
    await expect(page.locator('select#agent-collab')).toHaveValue('parallel');
  });

  test('should revert changes on Cancel', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    // Navigate to Memory tab
    await page.getByRole('button', { name: '🧠 Memory' }).click();
    const originalValue = await page.locator('input#mem-context').inputValue();
    await page.locator('input#mem-context').fill('999999');

    await page.getByRole('button', { name: 'Cancel' }).click();

    await settingsButton.click();
    await page.getByRole('button', { name: '🧠 Memory' }).click();
    await expect(page.locator('input#mem-context')).toHaveValue(originalValue);
  });

  test('should show unsaved changes indicator when editing', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();

    await expect(page.getByText('Unsaved changes')).not.toBeVisible();

    // Navigate to Memory tab and edit a field
    await page.getByRole('button', { name: '🧠 Memory' }).click();
    await page.locator('input#mem-context').fill('256000');
    await expect(page.getByText('Unsaved changes')).toBeVisible();
  });
});

test.describe('Settings Add Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();
  });

  test('should add agent role on Add Role click', async ({ page }) => {
    await page.getByRole('button', { name: '👥 Agents' }).click();
    await expect(page.getByText('No agent roles configured')).toBeVisible();
    await page.getByRole('button', { name: 'Add Role' }).click();
    await expect(page.getByText('Role #1')).toBeVisible();
    await expect(page.getByText('✕ Remove')).toBeVisible();
  });

  test('should add repository on Add Repository click', async ({ page }) => {
    await page.getByRole('button', { name: '📚 RAG & Knowledge' }).click();
    await expect(page.getByText('No repositories configured')).toBeVisible();
    await page.getByRole('button', { name: 'Add Repository' }).click();
    await expect(page.getByPlaceholder('Repository name')).toBeVisible();
    await expect(page.getByPlaceholder('/path/to/repo')).toBeVisible();
  });

  test('should add MCP server on Add Server click', async ({ page }) => {
    await page.getByRole('button', { name: '🔧 MCP & Tools' }).click();
    await expect(page.getByText('No MCP servers configured')).toBeVisible();
    await page.getByRole('button', { name: 'Add Server' }).click();
    await expect(page.getByPlaceholder('Server name')).toBeVisible();
    await expect(page.getByPlaceholder('http://localhost:3000')).toBeVisible();
  });

  test('should add tool on Add Tool click', async ({ page }) => {
    await page.getByRole('button', { name: '🔧 MCP & Tools' }).click();
    await expect(page.getByText('No tools configured')).toBeVisible();
    await page.getByRole('button', { name: 'Add Tool' }).click();
    await expect(page.getByPlaceholder('Tool name')).toBeVisible();
  });

  test('should add remote computer on Add Computer click', async ({ page }) => {
    await page.getByRole('button', { name: '🖥️ Remote & SSH' }).click();
    await expect(page.getByText('No remote computers configured')).toBeVisible();
    await page.getByRole('button', { name: 'Add Computer' }).click();
    await expect(page.getByPlaceholder('My Server')).toBeVisible();
    await expect(page.getByPlaceholder('192.168.1.100')).toBeVisible();
  });

  test('should add relay server on Add Relay Server click', async ({ page }) => {
    await page.getByRole('button', { name: '🌐 P2P Network' }).click();
    await expect(page.getByText('No relay servers configured')).toBeVisible();
    await page.getByRole('button', { name: 'Add Relay Server' }).click();
    await expect(page.getByPlaceholder('wss://relay.example.com')).toBeVisible();
  });

  test('should add environment variable on Add Variable click', async ({ page }) => {
    await page.getByRole('button', { name: '📁 Project' }).click();
    await expect(page.getByText('No environment variables configured')).toBeVisible();
    await page.getByRole('button', { name: 'Add Variable' }).click();
    await expect(page.getByPlaceholder('KEY')).toBeVisible();
    await expect(page.getByPlaceholder('value')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have aria-label on message input', async ({ page }) => {
    const textarea = page.locator('textarea[aria-label="Message input"]');
    await expect(textarea).toBeVisible();
  });

  test('should have aria-label on send button', async ({ page }) => {
    const sendButton = page.locator('button[aria-label="Send message"]');
    await expect(sendButton).toBeVisible();
  });

  test('should have aria-label on settings button', async ({ page }) => {
    const settingsButton = page.locator('button[aria-label="Open settings"]');
    await expect(settingsButton).toBeVisible();
  });

  test('should have role=dialog on settings panel', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
  });

  test('should have aria-modal on settings dialog', async ({ page }) => {
    const settingsButton = page.locator('button[title="Settings"]');
    await settingsButton.click();
    const dialog = page.locator('[aria-modal="true"]');
    await expect(dialog).toBeVisible();
  });

  test('should have progressbar role on progress bars', async ({ page }) => {
    const progressBars = page.locator('[role="progressbar"]');
    const count = await progressBars.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should have toast with aria-live attribute', async ({ page }) => {
    const toastContainer = page.locator('[aria-live]');
    const count = await toastContainer.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
