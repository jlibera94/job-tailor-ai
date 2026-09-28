# JobTailor AI - Testing Guide

## Quick Manual Test (5-10 min)

### Load Extension
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `job-tailor-ai` folder
5. Pin the extension icon to the toolbar

### Test Workflow A: CV Upload & Storage
1. Click the **JT** icon
2. Go to **Master CV** tab
3. Paste this sample resume:
   ```
   John Doe
   Senior Software Engineer | 8 years experience
   Location: Toronto, ON
   
   EXPERIENCE
   
   Tech Corp (2019–Present)
   Senior Engineer
   • Led team of 5 engineers building microservices architecture
   • Reduced API latency by 40% using caching strategies
   • Mentored 3 junior developers
   
   StartupXYZ (2016–2019)
   Full-Stack Developer
   • Built React + Node.js SaaS platform for 50k+ users
   • Implemented CI/CD pipeline (Jenkins, Docker)
   
   SKILLS
   JavaScript, React, Node.js, TypeScript, Docker, AWS, PostgreSQL
   ```
4. Click **Save Master CV**
5. Verify: "✓ Master CV saved" message appears
6. **Reload the extension** (click refresh icon on extension card)
7. **Verify:** CV is still there (persistence test)

### Test Workflow B: Job Scanning & Generation
1. Open [this LinkedIn job posting](https://www.linkedin.com/jobs/search/?keywords=Software%20Engineer) (or find your own)
2. Click on any job
3. In the side panel, click **Scan Page**
4. **Verify:** Job title, company, location, description appear
5. Click **Generate Tailored Application**
6. Wait ~2 seconds (mock AI latency)
7. **Verify:** Results tab shows:
   - Match score (should be ~78)
   - Analysis items (strong / good / gap)
   - Tailored resume with bullets
   - Company-specific cover letter
8. Click **Copy** buttons
9. **Verify:** Clipboard contains the text (paste in Notepad to test)

### Test Workflow C: Multiple Job Boards
Repeat Workflow B on:
- [Indeed job](https://www.indeed.com/)
- [Generic career page](https://boards.greenhouse.io/) (Greenhouse)

Expected: Extraction should work, though accuracy varies by platform.

---

## Debugging

### Check Extension Errors
- Right-click extension icon → **Inspect**
- **Console tab:** Check for errors in side panel
- **Background** (in extension list) → **Inspect**: Check service worker logs

### Check Content Script Errors
- Open DevTools on job posting page (`F12`)
- **Console tab:** Should show `"JobTailor AI content script loaded on [domain]"`
- If you see errors, extension can't inject the scanner

### Check Storage
- Extension **Inspect** → **Storage** → **Local Storage**
- Should see entry like: `{"masterCV": {"name": "John Doe", "text": "...", ...}}`

---

## Known Limitations (MVP 0.1)
- PDF/DOCX upload not yet supported (text only)
- AI generation is mocked (1200ms delay, hardcoded output)
- Job extraction relies on current page selectors (may break if LinkedIn/Indeed redesigns)
- No persistence of scan history

---

## Next Steps (v0.2+)
- [ ] Real OpenAI API integration
- [ ] PDF/DOCX parsing (pdf.js / mammoth)
- [ ] Better selector robustness (use more fallbacks)
- [ ] Automated tests
- [ ] Chrome Web Store submission

