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
