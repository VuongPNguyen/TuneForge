import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared mock metadata returned by /api/download
// ---------------------------------------------------------------------------
const MOCK_METADATA = {
  file_id: 'e2e-file-id-0000-0000-000000000000',
  title: 'E2E Test Track',
  artist: 'E2E Artist',
  album: 'E2E Album',
  album_artist: 'E2E Artist',
  year: '2024',
  track_number: '1',
  genre: 'Test',
  thumbnail_b64: null,
  duration: 210,
  webpage_url: 'https://www.youtube.com/watch?v=e2etest',
};

// ---------------------------------------------------------------------------
// Helper: mock all API routes for the page
// ---------------------------------------------------------------------------
async function mockAllApis(page: Page) {
  await page.route('/api/download', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_METADATA) }),
  );

  await page.route('/api/save', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'audio/mpeg',
      body: Buffer.from('fake-mp3-bytes'),
      headers: { 'Content-Disposition': 'attachment; filename="E2E Artist - E2E Test Track.mp3"' },
    }),
  );

  await page.route('/api/fetch-image', (route) => {
    const b64 = Buffer.from('fake-image').toString('base64');
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ image_b64: b64, mime_type: 'image/jpeg' }) });
  });
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------
test.describe('App shell', () => {
  test('shows the app header and brand name', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('YT to MP3')).toBeVisible();
  });

  test('shows the footer legal notice', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/personal use only/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// DownloadForm — initial state
// ---------------------------------------------------------------------------
test.describe('DownloadForm', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the heading and URL input', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /youtube to mp3/i })).toBeVisible();
    await expect(page.getByPlaceholder(/https:\/\/www\.youtube\.com/i)).toBeVisible();
  });

  test('shows all four bitrate buttons with 256 selected by default', async ({ page }) => {
    for (const b of ['96', '128', '256', '320']) {
      await expect(page.getByRole('button', { name: new RegExp(b) })).toBeVisible();
    }
    await expect(page.getByText('DEFAULT')).toBeVisible();
  });

  test('shows an error for a non-YouTube URL', async ({ page }) => {
    await page.fill('input[type="url"]', 'https://vimeo.com/123');
    await page.click('button[type="submit"]');
    await expect(page.getByText(/valid youtube video url/i)).toBeVisible();
  });

  test('submit button is disabled when the URL field is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: /convert to mp3/i })).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Full download → tag-editor flow (mocked API)
// ---------------------------------------------------------------------------
test.describe('Full download flow', () => {
  test('submitting a valid URL transitions to the tag editor', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/');

    await page.fill('input[type="url"]', 'https://www.youtube.com/watch?v=e2etest');
    await page.click('button[type="submit"]');

    // Should show the TagEditor
    await expect(page.getByRole('heading', { name: /edit id3 tags/i })).toBeVisible({ timeout: 5000 });
  });

  test('tag editor is pre-filled with metadata from the download response', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/');
    await page.fill('input[type="url"]', 'https://www.youtube.com/watch?v=e2etest');
    await page.click('button[type="submit"]');
    await page.waitForSelector('h2:has-text("Edit ID3 Tags")');

    await expect(page.locator('input[value="E2E Test Track"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Artist name"]')).toHaveValue('E2E Artist');
    await expect(page.locator('input[value="2024"]')).toBeVisible();
  });

  test('output filename preview reflects edits made in the tag editor', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/');
    await page.fill('input[type="url"]', 'https://www.youtube.com/watch?v=e2etest');
    await page.click('button[type="submit"]');
    await page.waitForSelector('h2:has-text("Edit ID3 Tags")');

    const titleInput = page.locator('input[placeholder="Track title"]');
    await titleInput.fill('Changed Title');
    await expect(page.getByText(/E2E Artist - Changed Title\.mp3/)).toBeVisible();
  });

  test('"New download" button resets to the download form', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/');
    await page.fill('input[type="url"]', 'https://www.youtube.com/watch?v=e2etest');
    await page.click('button[type="submit"]');
    await page.waitForSelector('h2:has-text("Edit ID3 Tags")');

    await page.getByRole('button', { name: /new download/i }).click();
    await expect(page.getByRole('heading', { name: /youtube to mp3/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// TagEditor — album art URL input
// ---------------------------------------------------------------------------
test.describe('TagEditor album art URL input', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/');
    await page.fill('input[type="url"]', 'https://www.youtube.com/watch?v=e2etest');
    await page.click('button[type="submit"]');
    await page.waitForSelector('h2:has-text("Edit ID3 Tags")');
  });

  test('shows an error message when the image URL fetch fails', async ({ page }) => {
    // Override fetch-image to return an error
    await page.route('/api/fetch-image', (route) =>
      route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ detail: 'Could not connect to the image URL' }) }),
    );

    await page.fill('input[placeholder="Paste image URL…"]', 'https://bad.example.com/img.jpg');
    await page.getByRole('button', { name: /apply/i }).click();
    await expect(page.getByText(/could not connect to the image url/i)).toBeVisible({ timeout: 5000 });
  });

  test('pressing Enter in the URL field does not submit the save form', async ({ page }) => {
    let saveHit = false;
    await page.route('/api/save', (route) => { saveHit = true; route.continue(); });

    await page.fill('input[placeholder="Paste image URL…"]', 'https://example.com/cover.jpg');
    await page.keyboard.press('Enter');
    // Give a moment for any unintended navigation
    await page.waitForTimeout(300);
    expect(saveHit).toBe(false);
    // Should still be on the tag editor
    await expect(page.getByRole('heading', { name: /edit id3 tags/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
test.describe('Error handling', () => {
  test('shows an error alert when the download API fails', async ({ page }) => {
    await page.route('/api/download', (route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ detail: 'URL must be a valid YouTube URL' }) }),
    );

    await page.goto('/');
    await page.fill('input[type="url"]', 'https://www.youtube.com/watch?v=test');
    await page.click('button[type="submit"]');

    await expect(page.getByText(/URL must be a valid YouTube URL/i)).toBeVisible({ timeout: 5000 });
  });

  test('error alert can be dismissed', async ({ page }) => {
    await page.route('/api/download', (route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ detail: 'Download failed' }) }),
    );

    await page.goto('/');
    await page.fill('input[type="url"]', 'https://www.youtube.com/watch?v=test');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Download failed');

    // Dismiss button is the only button inside the red error alert container
    await page.locator('.text-red-300 button').click();
    await expect(page.getByText('Download failed')).not.toBeVisible();
  });
});
