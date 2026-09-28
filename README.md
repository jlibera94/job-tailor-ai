# JobTailor AI

Chrome extension that turns any job posting into a tailored resume + cover letter using **only** the experience that already exists in your master CV.

## Features (MVP 0.1)

- **Side Panel UI** – clean dark interface that stays open while you browse
- **Job Scanner** – extracts title, company, location & description from:
  - LinkedIn
  - Indeed
  - Generic career pages (Greenhouse, Lever, Workday, etc.)
- **Master CV storage** – upload once, stored locally in `chrome.storage`
- **AI generation (mock)** – produces:
  - Match score
  - Requirement-by-requirement analysis (strong / good / gap)
  - Tailored professional summary + experience bullets
  - Company-specific cover letter
- **Copy to clipboard** for resume and cover letter

## How to load (unpacked)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `job-tailor-ai` folder
5. Pin the extension and click the icon (or open the side panel)

## Workflow

1. Go to the **Master CV** tab → paste your full resume text → Save
2. Navigate to a job posting (LinkedIn / Indeed / etc.)
3. Click **Scan Page**
4. Click **Generate Tailored Application**
5. Review the Results tab → copy what you need

## Project structure

```
job-tailor-ai/
├── manifest.json
├── background/
│   └── service-worker.js      # message routing + mock AI
├── content/
│   └── content.js             # page scrapers
├── sidepanel/
│   ├── sidepanel.html
│   ├── sidepanel.css
│   └── sidepanel.js
├── icons/
│   └── icon{16,32,48,128}.png
└── README.md
```

## Next steps (suggested order)

1. **Real PDF/DOCX parsing** (pdf.js + mammoth.js)
2. **Real AI backend** (OpenAI / Anthropic / local LLM) instead of the mock
3. **Better job extractors** for Workday, Greenhouse, Lever, Ashby
4. **DOCX / PDF export** of the generated documents
5. **Application tracker** (save past jobs + generated files)
6. **Multiple resume profiles** (QA-focused, Support-focused, etc.)

## Privacy

- In the current MVP everything stays inside your browser.
- When we add a real AI backend, only the job description + relevant CV sections will be sent, never your full browsing history.

---

Built as a continuation of the ChatGPT design session.
