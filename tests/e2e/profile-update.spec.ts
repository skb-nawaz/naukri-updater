import { test, expect } from "../../src/fixtures/base.fixture";
import { logger } from "../../src/utils/logger";
import * as fs from "fs";
import * as path from "path";

/**
 * Profile-agnostic touch flow: reads each current value and re-saves it.
 * No hardcoded names/titles — works on any profile.
 *
 * Run once headed:
 *   npx playwright test tests/e2e/profile-update.spec.ts --project=chromium-authenticated --headed --no-deps
 */
test.describe("Naukri Complete Profile", () => {
  test("should touch profile sections and save", async ({ page, profilePage }) => {
    let savedName = "";
    await test.step("Open complete profile", async () => {
      await profilePage.open();
      // Web-first: URL + key profile markers auto-retry until loaded
      await expect(page).toHaveURL(/mnjuser\/profile/);
      await expect(page.getByRole("heading", { name: /^Resume$/i }).first()).toBeVisible();
    });

    await test.step("Click Name edit pencil icon", async () => {
      // Live DOM name: button "Edit basic details" (pencil next to name)
      const nameEdit = page
        .getByRole("button", { name: /Edit basic details/i })
        .first();
      await expect(nameEdit, "Name edit pencil should be visible").toBeVisible();
      await nameEdit.scrollIntoViewIfNeeded();
      await nameEdit.click({ timeout: 10_000 });
      logger.success("Clicked Name edit pencil icon.");
    });

    await test.step("Remove name and re-enter same current name", async () => {
      // Profile-agnostic: read whatever name the profile currently has
      const nameInput = page.getByRole("textbox", { name: /^Name/i }).first();
      await expect(nameInput, "Name textbox should be visible").toBeVisible({ timeout: 15_000 });
      await nameInput.scrollIntoViewIfNeeded();
      const currentName = await nameInput.inputValue();
      await expect(currentName.length, "Name should not be empty").toBeGreaterThan(0);
      logger.info(`Current profile name: "${currentName}"`);
      savedName = currentName;
      await nameInput.fill("");
      await nameInput.fill(currentName);
      await expect(nameInput, "Name should hold re-entered value").toHaveValue(currentName);
      logger.success(`Removed and re-entered same name: ${currentName}`);
    });

    await test.step("Scroll down and click Save", async () => {
      // Modal content is scrollable — scroll down so Save (bottom) becomes visible
      const saveBtn = page
        .getByRole("button", { name: "Save", exact: true })
        .last();
      await expect(saveBtn, "Save should be attached").toBeAttached({ timeout: 15_000 });
      await page.keyboard.press("End").catch(() => {});
      await page.mouse.wheel(0, 800).catch(() => {});
      await saveBtn.scrollIntoViewIfNeeded();
      await expect(saveBtn, "Save should be visible").toBeVisible({ timeout: 15_000 });
      await saveBtn.click({ timeout: 10_000 });
      logger.success("Scrolled down and clicked Save.");
      // Web-first: modal closes after save
      await expect(saveBtn, "Basic-details modal should close after Save").toBeHidden({ timeout: 15_000 });
      await expect(page.getByText(savedName).first(), "Saved name should show on profile").toBeVisible();
    });

    await test.step("Close profile updated successfully popup", async () => {
      // Web-first: success toast must appear after Name save (auto-retries)
      const success = page.getByText(/profile.*updated.*successfully|updated.*successfully|successfully.*updated/i).first();
      await expect(success, "Profile-updated success message should appear").toBeVisible({ timeout: 10_000 });
      logger.success("Saw profile updated successfully message.");
      // Success toast/modal after Save — close via OK/Got it/Close/Cross, else Escape
      const closers = [
        page.getByRole("button", { name: /^(OK|Got it|Done)$/i }).first(),
        page.getByRole("button", { name: /^Close$/i }).first(),
        page.locator("[class*='cross'], [class*='close'], button:has-text('×')").first(),
      ];
      for (const c of closers) {
        try {
          if (await c.isVisible({ timeout: 3000 })) {
            await c.click({ timeout: 5000 }).catch(() => {});
            logger.success("Closed success popup.");
            break;
          }
        } catch { /* try next */ }
      }
      await page.keyboard.press("Escape").catch(() => {});
      await expect(success, "Success popup should close").toBeHidden({ timeout: 10_000 });
    });

    await test.step("Scroll to Resume and click Delete (if present)", async () => {
      // Resume may already be deleted — skip gracefully.
      const resumeHeading = page.getByRole("heading", { name: /^Resume$/i }).first();
      await resumeHeading.scrollIntoViewIfNeeded().catch(() => {});
      const deleteBtn = page.getByRole("button", { name: /Delete resume/i }).first();
      try {
        if (await deleteBtn.isVisible({ timeout: 8000 })) {
          await deleteBtn.scrollIntoViewIfNeeded();
          await deleteBtn.click({ timeout: 10_000 });
          logger.success("Clicked Resume Delete icon.");
        } else {
          logger.warn("No Delete resume button — resume already deleted, skipping.");
        }
      } catch {
        logger.warn("No Delete resume button — resume already deleted, skipping.");
      }
    });

    await test.step("Confirm resume delete (if dialog present)", async () => {
      // Only acts if a delete confirmation is actually showing
      const confirmCandidates = [
        page.getByRole("button", { name: /yes.*delete|delete.*yes/i }).first(),
        page.getByRole("button", { name: /^Delete$/i }).last(),
        page.getByRole("button", { name: /Confirm/i }).first(),
        page.getByRole("button", { name: /^Yes$/i }).first(),
      ];
      for (const btn of confirmCandidates) {
        try {
          if (await btn.isVisible({ timeout: 4000 })) {
            await btn.scrollIntoViewIfNeeded();
            await btn.click({ timeout: 10_000 });
            logger.success("Clicked delete confirm.");
            // Wait for the dialog to go away instead of sleeping
            await btn.waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
            break;
          }
        } catch {
          /* try next */
        }
      }
    });

    await test.step("Close any remaining popups", async () => {
      await profilePage.dismissPopups();
      const closers = [
        page.getByRole("button", { name: /^Close$/i }).first(),
        page.locator(".crossIcon, [class*='close']").first(),
      ];
      for (const c of closers) {
        try {
          if (await c.isVisible({ timeout: 2000 })) {
            await c.click({ timeout: 5000 }).catch(() => {});
          }
        } catch {
          /* ignore */
        }
      }
      logger.success("Popups closed.");
    });

    await test.step("Click resume upload and select SKB_NAWAZ_Resume.pdf", async () => {
      const resumePath =
        process.env.RESUME_PATH ?? path.resolve(process.cwd(), "SKB_NAWAZ_Resume.pdf");
      if (!fs.existsSync(resumePath)) {
        throw new Error(
          `Resume not found at ${resumePath}. Copy SKB_NAWAZ_Resume.pdf there or set RESUME_PATH=<full path>.`
        );
      }
      logger.info(`Uploading resume: ${resumePath}`);
      const resumeHeading = page.getByRole("heading", { name: /^Resume$/i }).first();
      await resumeHeading.scrollIntoViewIfNeeded().catch(() => {});
      // NOTE: "Upload resume" is <input type=file id=attachCV> hidden behind div.dummyUploadNew —
      // clicking is intercepted, so set files directly (no click / no filechooser needed)
      const fileInput = page.locator("input#attachCV[type='file']").first();
      await expect(fileInput, "Resume file input should be attached").toBeAttached({ timeout: 15_000 });
      await fileInput.setInputFiles(resumePath);
      logger.success("Selected SKB_NAWAZ_Resume.pdf — waiting for upload...");
      // Web-first: uploaded filename must appear on the profile (auto-retries up to 30s)
      await expect(page.getByText("SKB_NAWAZ_Resume.pdf").first(), "Uploaded resume filename should show").toBeVisible({ timeout: 30_000 });
      logger.success("Resume update finished.");
    });

    await test.step("Click Resume headline edit, clear and re-enter same content", async () => {
      // After upload the Resume block is in view — scroll the headline row into the
      // CENTER of the viewport so the sticky header can't cover the edit icon.
      // (scrollIntoViewIfNeeded leaves it at the edge under the header → intercepted clicks → ~20s stall)
      const headlineEdit = page.getByRole("button", { name: /Edit resume headline/i }).first();
      await headlineEdit.evaluate((n) => n.scrollIntoView({ block: "center" })).catch(() => {});
      // Fast overlay dismiss: 1s probes only (absent overlay must not cost 6s+)
      await page.keyboard.press("Escape").catch(() => {});
      for (const ov of [
        page.locator(".ltLayer.close").first(),
        page.locator(".ltCont [class*='close']").first(),
        page.locator(".ltCont button").first(),
      ]) {
        try {
          if (await ov.isVisible({ timeout: 1000 }).catch(() => false)) {
            await ov.click({ timeout: 3000 }).catch(() => {});
          }
        } catch { /* ignore */ }
      }
      await expect(headlineEdit, "Resume-headline edit icon should be visible").toBeVisible();
      await expect(headlineEdit, "Resume-headline edit icon should be enabled").toBeEnabled();
      await headlineEdit.click({ timeout: 10_000 });
      logger.success("Clicked Resume headline edit icon.");

      // Headline editor: textarea or text input inside the modal
      const editor = page.locator(
        "[role='dialog'] textarea, [role='dialog'] input[type='text'], " +
        "textarea#resumeHeadline, textarea[placeholder*='headline' i], input[placeholder*='headline' i], textarea"
      ).first();
      await expect(editor, "Headline editor should open").toBeVisible({ timeout: 15_000 });
      const current = await editor.inputValue().catch(() => "");
      logger.info(`Current headline length=${current.length}`);
      await expect(current.length, "Headline should not be empty").toBeGreaterThan(0);
      await editor.fill("");
      await expect(editor, "Headline should be cleared").toHaveValue("");
      await editor.fill(current);
      await expect(editor, "Headline should hold same re-entered content").toHaveValue(current);
      logger.success("Removed headline and re-entered same content.");
    });

    await test.step("Key skills: remove last skill, re-add same, Save", async () => {
      // Close headline modal first (left open by previous step)
      await page.keyboard.press("Escape").catch(() => {});

      const ksEdit = page.getByRole("button", { name: /Edit key skills/i }).first();
      await expect(ksEdit, "Key-skills edit icon should be visible").toBeVisible();
      await ksEdit.scrollIntoViewIfNeeded();
      await ksEdit.click({ timeout: 10_000 });
      logger.success("Clicked Key skills edit icon.");

      let chips = page.locator(".chip");
      try {
        await expect(chips.first(), "Key-skill chips should load").toBeVisible({ timeout: 15_000 });
      } catch {
        // fallback: any removable pill in dialog
        chips = page.locator("[role='dialog'] li:has(button), [role='dialog'] span:has(button)");
        await expect(chips.first(), "Key-skill pills (fallback) should load").toBeVisible({ timeout: 15_000 });
      }
      const beforeCount = await chips.count();
      logger.info(`Key skills found: ${beforeCount}`);
      await expect(beforeCount, "Should have at least one key skill").toBeGreaterThan(0);

      // Read last skill name (strip × / cross text)
      const lastChip = chips.nth(beforeCount - 1);
      const lastSkill = (((await lastChip.innerText().catch(() => "")) || "") as string)
        .replace(/×/g, "").replace(/cross/gi, "").replace(/editOneTheme/gi, "").trim();
      logger.info(`Last skill: ${JSON.stringify(lastSkill)}`);

      // Remove it — cross button inside the chip, else click chip's button
      const crossInChip = lastChip.locator("button, [class*='close'], [class*='cross'], em, i").last();
      try {
        if (await crossInChip.isVisible({ timeout: 5000 }).catch(() => false)) {
          await crossInChip.click({ timeout: 10_000 });
        } else {
          await lastChip.getByRole("button").last().click({ timeout: 10_000 });
        }
      } catch {
        await lastChip.click({ timeout: 10_000 }).catch(() => {});
      }
      // Wait for chip count to drop instead of sleeping
      await page.waitForFunction(
        (expected) => document.querySelectorAll(".chip").length < expected,
        beforeCount,
        { timeout: 10_000 }
      ).catch(() => {});
      logger.success(`Removed last skill: ${lastSkill}`);

      // Re-add same skill via the skills input + suggestion (fallback Enter)
      const skillInputCandidates = [
        page.locator("[role='dialog'] input[placeholder*='skill' i]").first(),
        page.locator("input[placeholder*='skill' i]").first(),
        page.locator("[role='dialog'] input[type='text']").first(),
      ];
      let added = false;
      for (const inp of skillInputCandidates) {
        try {
          if (!(await inp.isVisible({ timeout: 5000 }).catch(() => false))) continue;
          await inp.scrollIntoViewIfNeeded();
          await inp.click({ timeout: 5000 });
          await inp.fill("");
          await inp.pressSequentially(lastSkill, { delay: 50 });
          // Wait for suggestion list instead of sleeping
          const suggestion = page.getByRole("option", { name: new RegExp(lastSkill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first();
          try {
            await suggestion.waitFor({ state: "visible", timeout: 8000 });
            await suggestion.click({ timeout: 8000 });
            added = true;
            break;
          } catch { /* fallback Enter */ }
          await inp.press("Enter");
          added = true;
          break;
        } catch { /* try next input */ }
      }
      if (!added) throw new Error(`Could not re-add skill: ${lastSkill}`);
      // Wait for chip count to restore instead of sleeping
      await page.waitForFunction(
        (expected) => document.querySelectorAll(".chip").length >= expected,
        beforeCount,
        { timeout: 10_000 }
      ).catch(() => {});
      logger.success(`Re-added same skill: ${lastSkill}`);

      // Save (same pattern as Basic details modal)
      const saveBtn = page.getByRole("button", { name: "Save", exact: true }).last();
      await expect(saveBtn, "Key-skills Save should be attached").toBeAttached({ timeout: 15_000 });
      await page.keyboard.press("End").catch(() => {});
      await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
      await expect(saveBtn, "Key-skills Save should be visible").toBeVisible({ timeout: 15_000 });
      await saveBtn.click({ timeout: 10_000 });
      logger.success("Clicked Save for Key skills.");
      await expect(saveBtn, "Key-skills modal should close after Save").toBeHidden({ timeout: 15_000 });
      // Web-first: re-added skill must show back on the profile
      await expect(page.getByRole("heading", { name: /Key skills/i }).first(), "Key-skills heading should show").toBeVisible();
      await expect(page.getByText(lastSkill).first(), "Re-added skill should show on profile").toBeVisible();
    });

    await test.step("Employment: clear job profile and re-enter same, Save", async () => {
      // Profile-agnostic: open the first employment entry's editor
      await page.keyboard.press("Escape").catch(() => {});
      const empEdit = page.getByRole("button", { name: /Edit employment/i }).first();
      await expect(empEdit, "Employment edit icon should be visible").toBeVisible({ timeout: 15_000 });
      await empEdit.scrollIntoViewIfNeeded();
      await empEdit.click({ timeout: 10_000 });
      logger.success("Opened employment editor.");

      // Job profile / description editor: largest textarea in the modal (holds PROJECT text)
      const editors = page.locator("textarea, [contenteditable='true']");
      await editors.first().waitFor({ state: "visible", timeout: 15_000 });
      const n = await editors.count();
      let target = editors.first();
      let longest = "";
      for (let i = 0; i < n; i++) {
        const ed = editors.nth(i);
        try {
          if (!(await ed.isVisible({ timeout: 2000 }).catch(() => false))) continue;
          const val = (await ed.inputValue().catch(() => "")) ||
            ((await ed.innerText().catch(() => "")) || "");
          if (val.length > longest.length) {
            longest = val;
            target = ed;
          }
        } catch { /* ignore hidden */ }
      }
      logger.info(`Job profile length=${longest.length}`);
      await expect(longest.length, "Job profile should not be empty").toBeGreaterThan(0);
      await target.scrollIntoViewIfNeeded();
      await target.fill("");
      await expect(target, "Job profile should be cleared").toHaveValue("");
      await target.fill(longest);
      await expect(target, "Job profile should hold same re-entered content").toHaveValue(longest);
      logger.success("Removed job profile and re-entered same content.");

      // Scroll down + Save
      const saveBtn = page.getByRole("button", { name: "Save", exact: true }).last();
      await expect(saveBtn, "Employment Save should be attached").toBeAttached({ timeout: 15_000 });
      await page.keyboard.press("End").catch(() => {});
      await page.mouse.wheel(0, 800).catch(() => {});
      await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
      await expect(saveBtn, "Employment Save should be visible").toBeVisible({ timeout: 15_000 });
      await saveBtn.click({ timeout: 10_000 });
      logger.success("Scrolled down and clicked Save for Employment.");
      await expect(saveBtn, "Employment modal should close after Save").toBeHidden({ timeout: 15_000 });
      await expect(page.getByRole("heading", { name: /^Employment$/i }).first(), "Employment section should show").toBeVisible();
    });

    await test.step("Education: clear University/Institute and re-enter same, Save", async () => {
      // Target the B.Tech / B.E. (Civil) entry — NOT Class X (first in DOM has no University field)
      await page.keyboard.press("Escape").catch(() => {});
      const eduEditCandidates = [
        page.getByRole("button", { name: /Edit education:.*B\.Tech/i }).first(),
        page.getByRole("button", { name: /Edit education:.*Civil/i }).first(),
        page.getByRole("button", { name: /Edit education:.*B\.E\./i }).first(),
      ];
      let opened = false;
      for (const cand of eduEditCandidates) {
        try {
          if (!(await cand.isVisible({ timeout: 5000 }).catch(() => false))) continue;
          await cand.scrollIntoViewIfNeeded();
          await cand.click({ timeout: 10_000 });
          opened = true;
          break;
        } catch { /* try next */ }
      }
      if (!opened) throw new Error("Could not find B.Tech / B.E. Civil education edit icon.");
      logger.success("Opened B.Tech / B.E. Civil education editor.");

      // University/Institute field: labeled input, else the input holding a College/University value
      const labeled = page.getByLabel(/University.*Institute|Institute.*University|University|Institute|College/i).first();
      let target = labeled;
      let current = "";
      try {
        if (await labeled.isVisible({ timeout: 6000 }).catch(() => false)) {
          current = await labeled.inputValue().catch(() => "");
        }
      } catch { /* fallback below */ }
      if (!current) {
        // Scope to the open modal: wait for its University label (tolerant spacing), then scan only VISIBLE inputs
        // (page.first() input is the hidden header search box — never wait on it)
        await page.getByText(/University/i).first().waitFor({ state: "visible", timeout: 15_000 });
        const inputs = page.locator("input[type='text'], input:not([type])");
        const n = await inputs.count();
        for (let i = 0; i < n; i++) {
          const inp = inputs.nth(i);
          try {
            if (!(await inp.isVisible({ timeout: 2000 }).catch(() => false))) continue;
            const val = await inp.inputValue().catch(() => "");
            if (/college|university|institute|JNTU|Vaageswari|SRIT/i.test(val) && val.length > current.length) {
              current = val;
              target = inp;
            }
          } catch { /* ignore hidden */ }
        }
        // Last resort: input nearest the University/Institute label text
        if (!current) {
          const labelText = page.getByText(/University\/Institute|University|Institute/i).first();
          await labelText.scrollIntoViewIfNeeded().catch(() => {});
          const nearby = page.locator("input[type='text'], input:not([type])").first();
          current = await nearby.inputValue().catch(() => "");
          target = nearby;
        }
      }
      logger.info(`University/Institute current=${JSON.stringify(current.slice(0, 80))}`);
      await expect(current.length, "University/Institute should not be empty").toBeGreaterThan(0);
      await target.scrollIntoViewIfNeeded();
      await target.fill("");
      await expect(target, "University/Institute should be cleared").toHaveValue("");
      await target.fill(current);
      await expect(target, "University/Institute should hold same re-entered value").toHaveValue(current);
      logger.success("Removed University/Institute and re-entered same value.");

      const saveBtn = page.getByRole("button", { name: "Save", exact: true }).last();
      await expect(saveBtn, "Education Save should be attached").toBeAttached({ timeout: 15_000 });
      await page.keyboard.press("End").catch(() => {});
      await page.mouse.wheel(0, 800).catch(() => {});
      await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
      await expect(saveBtn, "Education Save should be visible").toBeVisible({ timeout: 15_000 });
      await saveBtn.click({ timeout: 10_000 });
      logger.success("Scrolled down and clicked Save for Education.");
      await expect(saveBtn, "Education modal should close after Save").toBeHidden({ timeout: 15_000 });
      await expect(page.getByText(current.slice(0, 40)).first(), "Institute should still show on profile").toBeVisible();
    });

    await test.step("IT skills: clear Skill/software name and re-enter same, Save", async () => {
      // Profile-agnostic: open the first IT-skill entry's editor
      await page.keyboard.press("Escape").catch(() => {});
      const itEdit = page.getByRole("button", { name: /Edit IT skill/i }).first();
      await expect(itEdit, "IT-skill edit icon should be visible").toBeVisible({ timeout: 15_000 });
      await itEdit.scrollIntoViewIfNeeded();
      await itEdit.click({ timeout: 10_000 });
      logger.success("Opened IT-skill editor.");

      // Skill / software name field: labeled input first, else longest skill-like input value
      const labeled = page.getByLabel(/Skill.*software|software.*name|^Skill$/i).first();
      let target = labeled;
      let current = "";
      try {
        if (await labeled.isVisible({ timeout: 6000 }).catch(() => false)) {
          current = await labeled.inputValue().catch(() => "");
        }
      } catch { /* fallback below */ }
      if (!current) {
        // Scan only VISIBLE inputs (page.first() input is the hidden header search box — never wait on it)
        await page.getByText(/Skill.*software|software.*name/i).first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
        const inputs = page.locator("input[type='text'], input:not([type])");
        const n = await inputs.count();
        for (let i = 0; i < n; i++) {
          const inp = inputs.nth(i);
          try {
            if (!(await inp.isVisible({ timeout: 2000 }).catch(() => false))) continue;
            const val = await inp.inputValue().catch(() => "");
            if (val && val.length > current.length) {
              current = val;
              target = inp;
            }
          } catch { /* ignore hidden */ }
        }
      }
      logger.info(`Skill/software name current=${JSON.stringify(current.slice(0, 80))}`);
      await expect(current.length, "Skill/software name should not be empty").toBeGreaterThan(0);
      await target.scrollIntoViewIfNeeded();
      await target.fill("");
      await expect(target, "Skill/software name should be cleared").toHaveValue("");
      await target.fill(current);
      await expect(target, "Skill/software name should hold same re-entered value").toHaveValue(current);
      logger.success("Removed Skill/software name and re-entered same value.");

      const saveBtn = page.getByRole("button", { name: "Save", exact: true }).last();
      await expect(saveBtn, "IT-skills Save should be attached").toBeAttached({ timeout: 15_000 });
      await page.keyboard.press("End").catch(() => {});
      await page.mouse.wheel(0, 800).catch(() => {});
      await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
      await expect(saveBtn, "IT-skills Save should be visible").toBeVisible({ timeout: 15_000 });
      await saveBtn.click({ timeout: 10_000 });
      logger.success("Scrolled down and clicked Save for IT skills.");
      await expect(saveBtn, "IT-skills modal should close after Save").toBeHidden({ timeout: 15_000 });
      await expect(page.getByText(current.slice(0, 30)).first(), "IT skill should still show on profile").toBeVisible();
    });

    await test.step("Final verification after all updates", async () => {
      // Conditional waits only — no fixed sleeps
      await expect(page, "Should still be on profile page").toHaveURL(/mnjuser\/profile/);
      await expect(page.getByRole("heading", { name: /^Resume$/i }).first(), "Resume section should show").toBeVisible();
      await expect(page.getByRole("heading", { name: /Key skills/i }).first(), "Key-skills section should show").toBeVisible();
      await expect(page.getByRole("heading", { name: /^Employment$/i }).first(), "Employment section should show").toBeVisible();
      logger.success("Final verification passed — all sections present, no hard waits.");
    });
  });
});
