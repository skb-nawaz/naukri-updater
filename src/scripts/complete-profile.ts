import { chromium, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { URLS } from '../constants/urls';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import { AUTH_FILE, BROWSER_FINGERPRINT, saveSession } from '../utils/auth';
import { LoginPage } from '../pages/LoginPage';

/**
 * SINGLE-RUN script (not a Playwright test project):
 *  1. Reuse saved session, else login once
 *  2. Full profile "touch" flow — re-save each section to bump Last Updated
 *  3. All locators are user-facing (getByRole / getByLabel / getByText /
 *     getByPlaceholder). Raw CSS is kept ONLY where no accessible
 *     equivalent exists (hidden file input #attachCV, skill `.chip` pills).
 *
 * Run once headed:
 *   npm run profile:complete:headed
 */

async function main(): Promise<void> {
  const HEADLESS = process.env.HEADLESS === 'true'; // default headed for this script
  logger.info(`Launching (headless=${HEADLESS}) — SINGLE run only...`);

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--start-maximized'],
  });

  const hasSession = fs.existsSync(AUTH_FILE);
  const context = await browser.newContext({
    ...BROWSER_FINGERPRINT,
    ...(hasSession ? { storageState: AUTH_FILE } : {}),
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  const page = await context.newPage();
  // Web-first assertions use expect auto-retry (15s per playwright.config) — no fixed sleeps

  try {
    // If no session, login once with decrypted creds
    if (!hasSession) {
      logger.info('No saved session — logging in once...');
      const loginPage = new LoginPage(page);
      await loginPage.login(env.requireEmail(), env.requirePassword());
      await saveSession(context);
    }

    logger.info(`Opening profile: ${URLS.profile}`);
    await page.goto(URLS.profile, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

    if (/nlogin|login/i.test(page.url())) {
      logger.info('Session expired — logging in once...');
      const loginPage = new LoginPage(page);
      await loginPage.login(env.requireEmail(), env.requirePassword());
      await saveSession(context);
      await page.goto(URLS.profile, { waitUntil: 'domcontentloaded' });
    }

    logger.info(`Navigated to Complete Profile: ${page.url()}`);

    // ── Open complete profile ──
    await expect(page).toHaveURL(/mnjuser\/profile/);
    await expect(page.getByRole('heading', { name: /^Resume$/i }).first()).toBeVisible();
    logger.success('Profile page loaded');

    // ── Basic details: Name edit → clear + re-enter same → Save ──
    let savedName = '';
    {
      const nameEdit = page.getByRole('button', { name: /Edit basic details/i }).first();
      await expect(nameEdit, 'Name edit pencil should be visible').toBeVisible();
      await nameEdit.scrollIntoViewIfNeeded();
      await nameEdit.click({ timeout: 10_000 });
      logger.success('Clicked Name edit pencil icon.');

      const nameInput = page.getByRole('textbox', { name: /^Name/i }).first();
      await expect(nameInput, 'Name textbox should be visible').toBeVisible({ timeout: 15_000 });
      await nameInput.scrollIntoViewIfNeeded();
      const currentName = await nameInput.inputValue();
      await expect(currentName.length, 'Name should not be empty').toBeGreaterThan(0);
      logger.info(`Current profile name: "${currentName}"`);
      savedName = currentName;
      await nameInput.fill('');
      await nameInput.fill(currentName);
      await expect(nameInput, 'Name should hold re-entered value').toHaveValue(currentName);
      logger.success(`Removed and re-entered same name: ${currentName}`);
    }
    {
      const saveBtn = page.getByRole('button', { name: 'Save', exact: true }).last();
      await expect(saveBtn, 'Save should be attached').toBeAttached({ timeout: 15_000 });
      await page.keyboard.press('End').catch(() => {});
      await page.mouse.wheel(0, 800).catch(() => {});
      await saveBtn.scrollIntoViewIfNeeded();
      await expect(saveBtn, 'Save should be visible').toBeVisible({ timeout: 15_000 });
      await saveBtn.click({ timeout: 10_000 });
      logger.success('Scrolled down and clicked Save.');
      await expect(saveBtn, 'Basic-details modal should close after Save').toBeHidden({ timeout: 15_000 });
      await expect(page.getByText(savedName).first(), 'Saved name should show on profile').toBeVisible();
    }
    {
      const success = page
        .getByText(/profile.*updated.*successfully|updated.*successfully|successfully.*updated/i)
        .first();
      await expect(success, 'Profile-updated success message should appear').toBeVisible({ timeout: 10_000 });
      logger.success('Saw profile updated successfully message.');
      const closers = [
        page.getByRole('button', { name: /^(OK|Got it|Done)$/i }).first(),
        page.getByRole('button', { name: /^Close$/i }).first(),
      ];
      for (const c of closers) {
        try {
          if (await c.isVisible({ timeout: 3000 })) {
            await c.click({ timeout: 5000 }).catch(() => {});
            logger.success('Closed success popup.');
            break;
          }
        } catch {
          /* try next */
        }
      }
      await page.keyboard.press('Escape').catch(() => {});
      await expect(success, 'Success popup should close').toBeHidden({ timeout: 10_000 });
    }

    // ── Resume: Delete (if present) → confirm → upload ──
    {
      const resumeHeading = page.getByRole('heading', { name: /^Resume$/i }).first();
      await resumeHeading.scrollIntoViewIfNeeded().catch(() => {});
      const deleteBtn = page.getByRole('button', { name: /Delete resume/i }).first();
      try {
        if (await deleteBtn.isVisible({ timeout: 8000 })) {
          await deleteBtn.scrollIntoViewIfNeeded();
          await deleteBtn.click({ timeout: 10_000 });
          logger.success('Clicked Resume Delete icon.');
        } else {
          logger.warn('No Delete resume button — resume already deleted, skipping.');
        }
      } catch {
        logger.warn('No Delete resume button — resume already deleted, skipping.');
      }
    }
    {
      const confirmCandidates = [
        page.getByRole('button', { name: /yes.*delete|delete.*yes/i }).first(),
        page.getByRole('button', { name: /^Delete$/i }).last(),
        page.getByRole('button', { name: /Confirm/i }).first(),
        page.getByRole('button', { name: /^Yes$/i }).first(),
      ];
      for (const btn of confirmCandidates) {
        try {
          if (await btn.isVisible({ timeout: 4000 })) {
            await btn.scrollIntoViewIfNeeded();
            await btn.click({ timeout: 10_000 });
            logger.success('Clicked delete confirm.');
            await btn.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
            break;
          }
        } catch {
          /* try next */
        }
      }
    }
    {
      // Dismiss any leftover overlay via accessible Close buttons
      const closers = [page.getByRole('button', { name: /^Close$/i }).first()];
      for (const c of closers) {
        try {
          if (await c.isVisible({ timeout: 2000 })) {
            await c.click({ timeout: 5000 }).catch(() => {});
          }
        } catch {
          /* ignore */
        }
      }
      logger.success('Popups closed.');
    }
    {
      const resumePath = process.env.RESUME_PATH ?? path.resolve(process.cwd(), 'SKB_NAWAZ_Resume.pdf');
      if (!fs.existsSync(resumePath)) {
        throw new Error(
          `Resume not found at ${resumePath}. Copy SKB_NAWAZ_Resume.pdf there or set RESUME_PATH=<full path>.`
        );
      }
      logger.info(`Uploading resume: ${resumePath}`);
      const resumeHeading = page.getByRole('heading', { name: /^Resume$/i }).first();
      await resumeHeading.scrollIntoViewIfNeeded().catch(() => {});
      // EXCEPTION: "Upload resume" is <input type=file id=attachCV> hidden behind
      // div.dummyUploadNew — no accessible role, so the raw CSS hook is required.
      const fileInput = page.locator("input#attachCV[type='file']").first();
      await expect(fileInput, 'Resume file input should be attached').toBeAttached({ timeout: 15_000 });
      await fileInput.setInputFiles(resumePath);
      logger.success('Selected SKB_NAWAZ_Resume.pdf — waiting for upload...');
      await expect(page.getByText('SKB_NAWAZ_Resume.pdf').first(), 'Uploaded resume filename should show').toBeVisible({
        timeout: 30_000,
      });
      logger.success('Resume update finished.');
    }

    // ── Resume headline: edit → clear + re-enter same ──
    {
      const headlineEdit = page.getByRole('button', { name: /Edit resume headline/i }).first();
      await headlineEdit.evaluate((n) => n.scrollIntoView({ block: 'center' })).catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
      const overlayCloser = page.getByRole('button', { name: /^Close$/i }).first();
      try {
        if (await overlayCloser.isVisible({ timeout: 1000 }).catch(() => false)) {
          await overlayCloser.click({ timeout: 3000 }).catch(() => {});
        }
      } catch {
        /* ignore */
      }
      await expect(headlineEdit, 'Resume-headline edit icon should be visible').toBeVisible();
      await expect(headlineEdit, 'Resume-headline edit icon should be enabled').toBeEnabled();
      await headlineEdit.click({ timeout: 10_000 });
      logger.success('Clicked Resume headline edit icon.');

      const editor = page
        .getByRole('dialog')
        .getByRole('textbox', { name: /headline|resume/i })
        .or(page.getByPlaceholder(/headline/i))
        .first();
      await expect(editor, 'Headline editor should open').toBeVisible({ timeout: 15_000 });
      const current = await editor.inputValue().catch(() => '');
      logger.info(`Current headline length=${current.length}`);
      await expect(current.length, 'Headline should not be empty').toBeGreaterThan(0);
      await editor.fill('');
      await expect(editor, 'Headline should be cleared').toHaveValue('');
      await editor.fill(current);
      await expect(editor, 'Headline should hold same re-entered content').toHaveValue(current);
      logger.success('Removed headline and re-entered same content.');
    }

    // ── Key skills: remove last → re-add same → Save ──
    {
      await page.keyboard.press('Escape').catch(() => {});
      const ksEdit = page.getByRole('button', { name: /Edit key skills/i }).first();
      await expect(ksEdit, 'Key-skills edit icon should be visible').toBeVisible();
      await ksEdit.scrollIntoViewIfNeeded();
      await ksEdit.click({ timeout: 10_000 });
      logger.success('Clicked Key skills edit icon.');

      // EXCEPTION: skill pills (`.chip`) expose no accessible role/name —
      // raw CSS is the only locator for counting/removing them.
      const chips = page.locator('.chip');
      await expect(chips.first(), 'Key-skill chips should load').toBeVisible({ timeout: 15_000 });
      const beforeCount = await chips.count();
      logger.info(`Key skills found: ${beforeCount}`);
      await expect(beforeCount, 'Should have at least one key skill').toBeGreaterThan(0);

      const lastChip = chips.nth(beforeCount - 1);
      const lastSkill = (((await lastChip.innerText().catch(() => '')) || '') as string)
        .replace(/×/g, '')
        .replace(/cross/gi, '')
        .replace(/editOneTheme/gi, '')
        .trim();
      logger.info(`Last skill: ${JSON.stringify(lastSkill)}`);

      const crossInChip = lastChip.getByRole('button').last();
      try {
        if (await crossInChip.isVisible({ timeout: 5000 }).catch(() => false)) {
          await crossInChip.click({ timeout: 10_000 });
        } else {
          await lastChip.click({ timeout: 10_000 }).catch(() => {});
        }
      } catch {
        await lastChip.click({ timeout: 10_000 }).catch(() => {});
      }
      await page
        .waitForFunction((expected) => document.querySelectorAll('.chip').length < expected, beforeCount, {
          timeout: 10_000,
        })
        .catch(() => {});
      logger.success(`Removed last skill: ${lastSkill}`);

      const skillInput = page
        .getByRole('dialog')
        .getByPlaceholder(/skill/i)
        .or(page.getByPlaceholder(/skill/i))
        .or(page.getByRole('dialog').getByRole('textbox').first())
        .first();
      await expect(skillInput, 'Skill input should be visible').toBeVisible({ timeout: 10_000 });
      await skillInput.scrollIntoViewIfNeeded();
      await skillInput.click({ timeout: 5000 });
      await skillInput.fill('');
      await skillInput.pressSequentially(lastSkill, { delay: 50 });
      const suggestion = page
        .getByRole('option', { name: new RegExp(lastSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
        .first();
      try {
        await suggestion.waitFor({ state: 'visible', timeout: 8000 });
        await suggestion.click({ timeout: 8000 });
      } catch {
        await skillInput.press('Enter');
      }
      await page
        .waitForFunction((expected) => document.querySelectorAll('.chip').length >= expected, beforeCount, {
          timeout: 10_000,
        })
        .catch(() => {});
      logger.success(`Re-added same skill: ${lastSkill}`);

      const saveBtn = page.getByRole('button', { name: 'Save', exact: true }).last();
      await expect(saveBtn, 'Key-skills Save should be attached').toBeAttached({ timeout: 15_000 });
      await page.keyboard.press('End').catch(() => {});
      await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
      await expect(saveBtn, 'Key-skills Save should be visible').toBeVisible({ timeout: 15_000 });
      await saveBtn.click({ timeout: 10_000 });
      logger.success('Clicked Save for Key skills.');
      await expect(saveBtn, 'Key-skills modal should close after Save').toBeHidden({ timeout: 15_000 });
      await expect(page.getByRole('heading', { name: /Key skills/i }).first(), 'Key-skills heading should show').toBeVisible();
      await expect(page.getByText(lastSkill).first(), 'Re-added skill should show on profile').toBeVisible();
    }

    // ── Employment: clear job profile → re-enter same → Save ──
    {
      await page.keyboard.press('Escape').catch(() => {});
      const empEdit = page.getByRole('button', { name: /Edit employment/i }).first();
      await expect(empEdit, 'Employment edit icon should be visible').toBeVisible({ timeout: 15_000 });
      await empEdit.scrollIntoViewIfNeeded();
      await empEdit.click({ timeout: 10_000 });
      logger.success('Opened employment editor.');

      // User-facing: all textboxes in the open dialog; target the longest (job profile)
      const editors = page.getByRole('dialog').getByRole('textbox');
      await editors.first().waitFor({ state: 'visible', timeout: 15_000 });
      const n = await editors.count();
      let target = editors.first();
      let longest = '';
      for (let i = 0; i < n; i++) {
        const ed = editors.nth(i);
        try {
          if (!(await ed.isVisible({ timeout: 2000 }).catch(() => false))) continue;
          const val = await ed.inputValue().catch(() => '');
          if (val.length > longest.length) {
            longest = val;
            target = ed;
          }
        } catch {
          /* ignore hidden */
        }
      }
      logger.info(`Job profile length=${longest.length}`);
      await expect(longest.length, 'Job profile should not be empty').toBeGreaterThan(0);
      await target.scrollIntoViewIfNeeded();
      await target.fill('');
      await expect(target, 'Job profile should be cleared').toHaveValue('');
      await target.fill(longest);
      await expect(target, 'Job profile should hold same re-entered content').toHaveValue(longest);
      logger.success('Removed job profile and re-entered same content.');

      const saveBtn = page.getByRole('button', { name: 'Save', exact: true }).last();
      await expect(saveBtn, 'Employment Save should be attached').toBeAttached({ timeout: 15_000 });
      await page.keyboard.press('End').catch(() => {});
      await page.mouse.wheel(0, 800).catch(() => {});
      await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
      await expect(saveBtn, 'Employment Save should be visible').toBeVisible({ timeout: 15_000 });
      await saveBtn.click({ timeout: 10_000 });
      logger.success('Scrolled down and clicked Save for Employment.');
      await expect(saveBtn, 'Employment modal should close after Save').toBeHidden({ timeout: 15_000 });
      await expect(page.getByRole('heading', { name: /^Employment$/i }).first(), 'Employment section should show').toBeVisible();
    }

    // ── Education: University/Institute → clear + re-enter same → Save ──
    {
      await page.keyboard.press('Escape').catch(() => {});
      const eduEditCandidates = [
        page.getByRole('button', { name: /Edit education:.*B\.Tech/i }).first(),
        page.getByRole('button', { name: /Edit education:.*Civil/i }).first(),
        page.getByRole('button', { name: /Edit education:.*B\.E\./i }).first(),
      ];
      let opened = false;
      for (const cand of eduEditCandidates) {
        try {
          if (!(await cand.isVisible({ timeout: 5000 }).catch(() => false))) continue;
          await cand.scrollIntoViewIfNeeded();
          await cand.click({ timeout: 10_000 });
          opened = true;
          break;
        } catch {
          /* try next */
        }
      }
      if (!opened) throw new Error('Could not find B.Tech / B.E. Civil education edit icon.');
      logger.success('Opened B.Tech / B.E. Civil education editor.');

      // User-facing: label → control association first
      const labeled = page.getByLabel(/University.*Institute|Institute.*University|University|Institute|College/i).first();
      let target = labeled;
      let current = '';
      try {
        if (await labeled.isVisible({ timeout: 6000 }).catch(() => false)) {
          current = await labeled.inputValue().catch(() => '');
        }
      } catch {
        /* fallback below */
      }
      if (!current) {
        await page.getByText(/University/i).first().waitFor({ state: 'visible', timeout: 15_000 });
        const inputs = page.getByRole('dialog').getByRole('textbox');
        const n = await inputs.count();
        for (let i = 0; i < n; i++) {
          const inp = inputs.nth(i);
          try {
            if (!(await inp.isVisible({ timeout: 2000 }).catch(() => false))) continue;
            const val = await inp.inputValue().catch(() => '');
            if (/college|university|institute|JNTU|Vaageswari|SRIT/i.test(val) && val.length > current.length) {
              current = val;
              target = inp;
            }
          } catch {
            /* ignore hidden */
          }
        }
      }
      logger.info(`University/Institute current=${JSON.stringify(current.slice(0, 80))}`);
      await expect(current.length, 'University/Institute should not be empty').toBeGreaterThan(0);
      await target.scrollIntoViewIfNeeded();
      await target.fill('');
      await expect(target, 'University/Institute should be cleared').toHaveValue('');
      await target.fill(current);
      await expect(target, 'University/Institute should hold same re-entered value').toHaveValue(current);
      logger.success('Removed University/Institute and re-entered same value.');

      const saveBtn = page.getByRole('button', { name: 'Save', exact: true }).last();
      await expect(saveBtn, 'Education Save should be attached').toBeAttached({ timeout: 15_000 });
      await page.keyboard.press('End').catch(() => {});
      await page.mouse.wheel(0, 800).catch(() => {});
      await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
      await expect(saveBtn, 'Education Save should be visible').toBeVisible({ timeout: 15_000 });
      await saveBtn.click({ timeout: 10_000 });
      logger.success('Scrolled down and clicked Save for Education.');
      await expect(saveBtn, 'Education modal should close after Save').toBeHidden({ timeout: 15_000 });
      await expect(page.getByText(current.slice(0, 40)).first(), 'Institute should still show on profile').toBeVisible();
    }

    // ── IT skills: Skill/software name → clear + re-enter same → Save ──
    {
      await page.keyboard.press('Escape').catch(() => {});
      const itEdit = page.getByRole('button', { name: /Edit IT skill/i }).first();
      await expect(itEdit, 'IT-skill edit icon should be visible').toBeVisible({ timeout: 15_000 });
      await itEdit.scrollIntoViewIfNeeded();
      await itEdit.click({ timeout: 10_000 });
      logger.success('Opened IT-skill editor.');

      const labeled = page.getByLabel(/Skill.*software|software.*name|^Skill$/i).first();
      let target = labeled;
      let current = '';
      try {
        if (await labeled.isVisible({ timeout: 6000 }).catch(() => false)) {
          current = await labeled.inputValue().catch(() => '');
        }
      } catch {
        /* fallback below */
      }
      if (!current) {
        await page.getByText(/Skill.*software|software.*name/i).first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
        const inputs = page.getByRole('dialog').getByRole('textbox');
        const n = await inputs.count();
        for (let i = 0; i < n; i++) {
          const inp = inputs.nth(i);
          try {
            if (!(await inp.isVisible({ timeout: 2000 }).catch(() => false))) continue;
            const val = await inp.inputValue().catch(() => '');
            if (val && val.length > current.length) {
              current = val;
              target = inp;
            }
          } catch {
            /* ignore hidden */
          }
        }
      }
      logger.info(`Skill/software name current=${JSON.stringify(current.slice(0, 80))}`);
      await expect(current.length, 'Skill/software name should not be empty').toBeGreaterThan(0);
      await target.scrollIntoViewIfNeeded();
      await target.fill('');
      await expect(target, 'Skill/software name should be cleared').toHaveValue('');
      await target.fill(current);
      await expect(target, 'Skill/software name should hold same re-entered value').toHaveValue(current);
      logger.success('Removed Skill/software name and re-entered same value.');

      const saveBtn = page.getByRole('button', { name: 'Save', exact: true }).last();
      await expect(saveBtn, 'IT-skills Save should be attached').toBeAttached({ timeout: 15_000 });
      await page.keyboard.press('End').catch(() => {});
      await page.mouse.wheel(0, 800).catch(() => {});
      await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
      await expect(saveBtn, 'IT-skills Save should be visible').toBeVisible({ timeout: 15_000 });
      await saveBtn.click({ timeout: 10_000 });
      logger.success('Scrolled down and clicked Save for IT skills.');
      await expect(saveBtn, 'IT-skills modal should close after Save').toBeHidden({ timeout: 15_000 });
      await expect(page.getByText(current.slice(0, 30)).first(), 'IT skill should still show on profile').toBeVisible();
    }

    // ── Final verification ──
    await expect(page, 'Should still be on profile page').toHaveURL(/mnjuser\/profile/);
    await expect(page.getByRole('heading', { name: /^Resume$/i }).first(), 'Resume section should show').toBeVisible();
    await expect(page.getByRole('heading', { name: /Key skills/i }).first(), 'Key-skills section should show').toBeVisible();
    await expect(page.getByRole('heading', { name: /^Employment$/i }).first(), 'Employment section should show').toBeVisible();
    logger.success('Final verification passed — all sections present, no hard waits.');

    await page.screenshot({ path: 'test-results/complete-profile.png' });
    logger.success('Screenshot: test-results/complete-profile.png');
  } finally {
    await browser.close();
    logger.info('Browser closed. Done (ran once).');
  }
}

main().catch((e) => {
  logger.error(`Failed: ${(e as Error).message}`);
  process.exit(1);
});
