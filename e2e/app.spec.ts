import { test, expect } from '@playwright/test';

test.describe('IPL Lab E2E', () => {
  test('should load app and show all tabs', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to load
    await expect(page.locator('h1')).toContainText('IPL Lab');
    
    // Check all tabs are present
    await expect(page.locator('text=Learn')).toBeVisible();
    await expect(page.locator('text=Debugger')).toBeVisible();
    await expect(page.locator('text=Docs')).toBeVisible();
  });

  test('should navigate to lessons and scroll', async ({ page }) => {
    await page.goto('/');
    
    // Should be in Learn tab by default
    await expect(page.locator('text=Learn Assembly')).toBeVisible();
    
    // Wait for lessons to load
    await page.waitForSelector('[data-testid="lesson-card"]', { timeout: 10000 });
    
    // Test lesson list scrolling
    const lessonList = page.locator('[data-testid="lesson-list"]');
    await expect(lessonList).toBeVisible();
    
    // Scroll the lesson list
    await lessonList.evaluate(el => el.scrollTop = 99999);
    
    // Verify scroll position changed
    const scrollTop = await lessonList.evaluate(el => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
  });

  test('should navigate to challenges and scroll', async ({ page }) => {
    await page.goto('/');
    
    // Switch to Challenges tab
    await page.click('text=Challenges');
    
    // Wait for challenges to load
    await page.waitForSelector('[data-testid="challenge-card"]', { timeout: 10000 });
    
    // Test challenge list scrolling
    const challengeList = page.locator('[data-testid="challenge-list"]');
    await expect(challengeList).toBeVisible();
    
    // Scroll the challenge list
    await challengeList.evaluate(el => el.scrollTop = 99999);
    
    // Verify scroll position changed
    const scrollTop = await challengeList.evaluate(el => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
  });

  test('should scroll lesson content properly', async ({ page }) => {
    await page.goto('/');
    
    // Should be in Learn tab by default, wait for lessons to load
    await page.waitForSelector('[data-testid="lesson-card"]', { timeout: 10000 });
    
    // Click on first lesson to load content
    await page.click('[data-testid="lesson-card"]');
    
    // Wait for lesson content to appear
    await page.waitForTimeout(1000);
    
    // Find the lesson content area and scroll it
    const lessonContent = page.locator('.flex-1 .scroll-chrome').nth(1); // Second scroll area is content
    await expect(lessonContent).toBeVisible();
    
    // Scroll the lesson content
    await lessonContent.evaluate(el => el.scrollTop = 500);
    
    // Verify scroll position changed
    const scrollTop = await lessonContent.evaluate(el => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
  });

  test('should work in Debugger mode', async ({ page }) => {
    await page.goto('/');
    
    // Switch to Debugger
    await page.click('text=Debugger');
    
    // Should show debugger interface
    await expect(page.locator('text=Assembly Debugger')).toBeVisible();
    
    // Should have control buttons
    await expect(page.locator('text=Step')).toBeVisible();
    await expect(page.locator('text=Run')).toBeVisible();
    await expect(page.locator('text=Reset')).toBeVisible();
    
    // Should show debugger container
    await expect(page.locator('[data-testid="debugger-container"]')).toBeVisible();
  });

  test('should open lesson in debugger', async ({ page }) => {
    await page.goto('/');
    
    // Wait for lessons to load
    await page.waitForSelector('[data-testid="lesson-card"]', { timeout: 10000 });
    
    // Click on first lesson
    await page.click('[data-testid="lesson-card"]');
    
    // Wait for lesson content
    await page.waitForSelector('[data-testid="snippet-debug-btn"]', { timeout: 5000 });
    
    // Click "Debug" button on first snippet
    await page.click('[data-testid="snippet-debug-btn"]');
    
    // Should navigate to debugger tab
    await expect(page.locator('text=Assembly Debugger')).toBeVisible();
    
    // Should populate editor within 150ms
    await page.waitForTimeout(200);
    
    // Should show some code in the editor
    const editorContent = await page.locator('textarea').inputValue();
    expect(editorContent.length).toBeGreaterThan(0);
  });

  test('should reset debugger without errors', async ({ page }) => {
    await page.goto('/');
    
    // Switch to Debugger
    await page.click('text=Debugger');
    
    // Wait for debugger to load
    await page.waitForSelector('[data-testid="debugger-container"]', { timeout: 10000 });
    
    // Click Reset button
    await page.click('text=Reset');
    
    // Should not show any console errors
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    
    // Wait a bit for any errors to surface
    await page.waitForTimeout(1000);
    
    // Should not have any console errors
    expect(logs.filter(log => log.includes('handleReset'))).toHaveLength(0);
  });

  test('should render docs without errors', async ({ page }) => {
    await page.goto('/');
    
    // Switch to Docs
    await page.click('text=Docs');
    
    // Should show docs interface
    await expect(page.locator('text=Assembly Reference')).toBeVisible();
    
    // Should not show any console errors
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    
    // Wait for docs to load
    await page.waitForTimeout(2000);
    
    // Should not have "Memory is not defined" error
    expect(logs.filter(log => log.includes('Memory is not defined'))).toHaveLength(0);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Should still show main elements
    await expect(page.locator('h1')).toContainText('IPL Lab');
    await expect(page.locator('text=Learn')).toBeVisible();
    
    // Navigation should work
    await page.click('text=Debugger');
    await expect(page.locator('text=Assembly Debugger')).toBeVisible();
  });
});