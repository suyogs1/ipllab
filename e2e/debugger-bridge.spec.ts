import { test, expect } from '@playwright/test';

test.describe('Debugger Bridge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load lesson code in debugger with breakpoints', async ({ page }) => {
    // Navigate to Learn tab (should be default)
    await expect(page.locator('[data-testid="learn-tab"]')).toBeVisible();
    
    // Wait for lessons to load
    await page.waitForSelector('[data-testid="lesson-card"]', { timeout: 5000 });
    
    // Click on first lesson
    await page.locator('[data-testid="lesson-card"]').first().click();
    
    // Wait for lesson content to load
    await page.waitForSelector('[data-testid="lesson-snippet"]', { timeout: 3000 });
    
    // Click "Debug" button on first code snippet
    await page.locator('[data-testid="snippet-debug-btn"]').first().click();
    
    // Should navigate to debugger tab
    await expect(page.locator('[data-testid="debug-tab"]')).toHaveClass(/active/);
    
    // Verify code is loaded in editor
    const editor = page.locator('[data-testid="code-editor"]');
    await expect(editor).toBeVisible();
    
    // Verify at least one breakpoint is set
    await expect(page.locator('[data-testid="breakpoint-indicator"]')).toHaveCount({ min: 1 });
    
    // Verify watches panel shows watch expressions
    await page.locator('[data-testid="watches-tab"]').click();
    await expect(page.locator('[data-testid="watch-expression"]')).toHaveCount({ min: 0 });
  });

  test('should load challenge code in debugger with setup', async ({ page }) => {
    // Navigate to Learn tab
    await page.locator('[data-testid="learn-tab"]').click();
    
    // Switch to challenges tab
    await page.locator('[data-testid="challenges-subtab"]').click();
    
    // Wait for challenges to load
    await page.waitForSelector('[data-testid="challenge-card"]', { timeout: 5000 });
    
    // Click on first challenge
    await page.locator('[data-testid="challenge-card"]').first().click();
    
    // Click "Debug" button
    await page.locator('[data-testid="challenge-debug-btn"]').click();
    
    // Should navigate to debugger tab within 150ms
    const startTime = Date.now();
    await expect(page.locator('[data-testid="debug-tab"]')).toHaveClass(/active/);
    const endTime = Date.now();
    
    expect(endTime - startTime).toBeLessThan(150);
    
    // Verify code is loaded
    const editor = page.locator('[data-testid="code-editor"]');
    await expect(editor).toBeVisible();
    const editorContent = await editor.inputValue();
    expect(editorContent.length).toBeGreaterThan(0);
    
    // Verify breakpoint is set at first line
    await expect(page.locator('[data-testid="breakpoint-indicator"]').first()).toBeVisible();
  });

  test('should persist pending load after page reload', async ({ page }) => {
    // Navigate to Learn tab and load code in debugger
    await page.locator('[data-testid="learn-tab"]').click();
    await page.waitForSelector('[data-testid="lesson-card"]', { timeout: 5000 });
    await page.locator('[data-testid="lesson-card"]').first().click();
    await page.waitForSelector('[data-testid="lesson-snippet"]', { timeout: 3000 });
    await page.locator('[data-testid="snippet-debug-btn"]').first().click();
    
    // Get the loaded code content
    const editor = page.locator('[data-testid="code-editor"]');
    const originalContent = await editor.inputValue();
    
    // Reload the page
    await page.reload();
    
    // Navigate back to debugger
    await page.locator('[data-testid="debug-tab"]').click();
    
    // Verify code is still loaded
    await expect(editor).toBeVisible();
    const reloadedContent = await editor.inputValue();
    expect(reloadedContent).toBe(originalContent);
    
    // Verify breakpoints are still set
    await expect(page.locator('[data-testid="breakpoint-indicator"]')).toHaveCount({ min: 1 });
  });

  test('should show toast notification when loading in debugger', async ({ page }) => {
    // Navigate to Learn tab
    await page.locator('[data-testid="learn-tab"]').click();
    await page.waitForSelector('[data-testid="lesson-card"]', { timeout: 5000 });
    await page.locator('[data-testid="lesson-card"]').first().click();
    await page.waitForSelector('[data-testid="lesson-snippet"]', { timeout: 3000 });
    
    // Click debug button
    await page.locator('[data-testid="snippet-debug-btn"]').first().click();
    
    // Verify toast appears
    await expect(page.locator('[data-testid="toast"]')).toBeVisible();
    await expect(page.locator('[data-testid="toast"]')).toContainText('Loaded in Debugger');
  });

  test('should not show blank screen when typing after load', async ({ page }) => {
    // Load code in debugger
    await page.locator('[data-testid="learn-tab"]').click();
    await page.waitForSelector('[data-testid="lesson-card"]', { timeout: 5000 });
    await page.locator('[data-testid="lesson-card"]').first().click();
    await page.waitForSelector('[data-testid="lesson-snippet"]', { timeout: 3000 });
    await page.locator('[data-testid="snippet-debug-btn"]').first().click();
    
    // Wait for debugger to load
    await expect(page.locator('[data-testid="debug-tab"]')).toHaveClass(/active/);
    const editor = page.locator('[data-testid="code-editor"]');
    await expect(editor).toBeVisible();
    
    // Type in the editor
    await editor.click();
    await page.keyboard.type('\n; Added comment');
    
    // Verify editor is still visible and functional
    await expect(editor).toBeVisible();
    const content = await editor.inputValue();
    expect(content).toContain('; Added comment');
    
    // Verify no blank/white screen
    const debuggerContainer = page.locator('[data-testid="debugger-container"]');
    await expect(debuggerContainer).toBeVisible();
  });
});