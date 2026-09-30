const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadScriptWithDom() {
  const scriptPath = path.join(__dirname, '..', 'content', 'content.js');
  const source = fs.readFileSync(scriptPath, 'utf8');

  const titleEl = {
    innerText: 'Senior Technical Success Engineer',
    textContent: 'Senior Technical Success Engineer',
    nextElementSibling: null,
  };
  const companyEl = {
    innerText: 'Backstory',
    textContent: 'Backstory',
    nextElementSibling: null,
  };
  const locationEl = {
    innerText: 'Toronto, ON · 1 month ago',
    textContent: 'Toronto, ON · 1 month ago',
    nextElementSibling: null,
  };
  const descriptionEl = {
    innerText: 'As a Senior Technical Success Engineer...',
    textContent: 'As a Senior Technical Success Engineer...',
    nextElementSibling: null,
  };

  const selectors = {
    "[class*='job-title']": titleEl,
    "[class*='jobTitle']": titleEl,
    "[class*='company-name']": companyEl,
    "[class*='companyName']": companyEl,
    "[class*='location']": locationEl,
    "#job-details": descriptionEl,
    "[class*='jobs-description']": descriptionEl,
    "h1, h2": [titleEl],
    "h2, h3": [descriptionEl],
    "article, section, div": [descriptionEl],
  };

  const context = {
    console,
    chrome: {
      runtime: {
        onMessage: { addListener() {} },
      },
    },
    window: {
      location: {
        hostname: 'www.linkedin.com',
        href: 'https://www.linkedin.com/jobs/view/123456789',
      },
    },
    document: {
      querySelector(selector) {
        return selectors[selector] || null;
      },
      querySelectorAll(selector) {
        const value = selectors[selector];
        return Array.isArray(value) ? value : value ? [value] : [];
      },
    },
  };

  vm.runInNewContext(source, context);
  return context;
}

test('extractLinkedIn populates title, company, and description for current LinkedIn structure', () => {
  const { extractLinkedIn } = loadScriptWithDom();

  const job = extractLinkedIn();

  assert.equal(job.source, 'linkedin');
  assert.equal(job.title, 'Senior Technical Success Engineer');
  assert.equal(job.company, 'Backstory');
  assert.match(job.description, /Senior Technical Success Engineer/i);
});

test('extractGeneric prefers job metadata over generic nav text', () => {
  const scriptPath = path.join(__dirname, '..', 'content', 'content.js');
  const source = fs.readFileSync(scriptPath, 'utf8');

  const navText = { innerText: '0 notifications', textContent: '0 notifications' };
  const mainBlock = {
    innerText: 'About the Role Customer Success Manager, Canada (Toronto) ...',
    textContent: 'About the Role Customer Success Manager, Canada (Toronto) ...'
  };

  const metaTitle = { getAttribute(attr) { return attr === 'property' ? 'og:title' : attr === 'content' ? 'Customer Success Manager, Canada (Toronto)' : null; } };
  const metaSite = { getAttribute(attr) { return attr === 'property' ? 'og:site_name' : attr === 'content' ? 'Abnormal AI' : null; } };
  const selectors = {
    h1: navText,
    main: mainBlock,
    article: mainBlock,
    div: mainBlock,
    section: mainBlock,
    "[role='main']": mainBlock,
    "[class*='job-title']": null,
    "[class*='JobTitle']": null,
  };

  const context = {
    console,
    chrome: { runtime: { onMessage: { addListener() {} } } },
    window: { location: { hostname: 'www.abnormal.ai', href: 'https://www.abnormal.ai/careers/customer-success-manager' } },
    document: {
      title: 'Customer Success Manager, Canada (Toronto) | Abnormal AI',
      body: { innerText: '0 notifications About the Role Customer Success Manager, Canada (Toronto) ...', textContent: '0 notifications About the Role Customer Success Manager, Canada (Toronto) ...' },
      querySelector(selector) {
        return selectors[selector] || null;
      },
      querySelectorAll(selector) {
        if (selector === 'meta') return [metaTitle, metaSite];
        const value = selectors[selector];
        return value ? [value] : [];
      }
    }
  };

  vm.runInNewContext(source, context);

  const job = context.extractGeneric();

  assert.equal(job.title, 'Customer Success Manager, Canada (Toronto)');
  assert.equal(job.company, 'Abnormal AI');
  assert.match(job.description, /Customer Success Manager/i);
});

test('handleGenerate preserves the complete original resume in the tailored output', async () => {
  const scriptPath = path.join(__dirname, '..', 'background', 'service-worker.js');
  const source = fs.readFileSync(scriptPath, 'utf8');

  const context = {
    console,
    chrome: {
      action: { onClicked: { addListener() {} } },
      sidePanel: { setPanelBehavior() { return Promise.resolve(); } },
      runtime: { onMessage: { addListener() {} } },
      tabs: { query() { return Promise.resolve([{ id: 1, url: 'https://www.linkedin.com/jobs/view/123' }]); } },
      scripting: { executeScript() { return Promise.resolve(); } },
      storage: { local: { get() {}, set() {} } }
    },
    setTimeout,
    clearTimeout,
    Promise,
    URL,
    Blob
  };

  vm.runInNewContext(source, context);
  const resumeText = `John Doe\n\nExperience\nSenior Technical Support Specialist — TELUS International\n2021 – Present\n• Supported customers and resolved technical issues\n• Worked cross-functionally with engineering\n\nCustomer Support Lead — Shopify\n2019 – 2021\n• Managed customer relationships\n• Tracked escalations and product feedback`;
  const result = await context.handleGenerate({
    job: { title: 'Customer Success Manager', company: 'Abnormal AI', description: 'Customer Success Manager role.' },
    masterCV: {
      name: 'John Doe',
      text: resumeText
    }
  });

  assert.equal(result.tailoredResume.originalText, resumeText);
  assert.match(result.tailoredResume.originalText, /Senior Technical Support Specialist/);
  assert.match(result.tailoredResume.originalText, /Customer Support Lead/);
  assert.match(result.tailoredResume.originalText, /Tracked escalations and product feedback/);
});
