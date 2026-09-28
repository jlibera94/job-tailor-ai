/**
 * JobTailor AI — Content Script
 * Extracts job title, company, location, description and requirements
 * from common job boards and generic career pages.
 */

function cleanText(el) {
  if (!el) return "";
  return el.innerText?.replace(/\s+/g, " ").trim() || "";
}

function extractLinkedIn() {
  // Title – try several current LinkedIn selectors
  const title =
    cleanText(document.querySelector(".job-details-jobs-unified-top-card__job-title h1")) ||
    cleanText(document.querySelector(".job-details-jobs-unified-top-card__job-title")) ||
    cleanText(document.querySelector("h1.t-24")) ||
    cleanText(document.querySelector("h1.job-title")) ||
    cleanText(document.querySelector("h1"));

  // Company
  const company =
    cleanText(document.querySelector(".job-details-jobs-unified-top-card__company-name a")) ||
    cleanText(document.querySelector(".job-details-jobs-unified-top-card__company-name")) ||
    cleanText(document.querySelector(".jobs-unified-top-card__company-name a")) ||
    cleanText(document.querySelector(".jobs-unified-top-card__company-name")) ||
    cleanText(document.querySelector("a[data-tracking-control-name*='company']"));

  // Location – often in a secondary line with the company
  const location =
    cleanText(document.querySelector(".job-details-jobs-unified-top-card__primary-description-container")) ||
    cleanText(document.querySelector(".job-details-jobs-unified-top-card__bullet")) ||
    cleanText(document.querySelector(".jobs-unified-top-card__bullet")) ||
    cleanText(document.querySelector(".tvm__text--low-emphasis"));

  // Description – “About the job” section
  const descriptionEl =
    document.querySelector("#job-details") ||
    document.querySelector(".jobs-description__content") ||
    document.querySelector(".jobs-box__html-content") ||
    document.querySelector(".description__text") ||
    document.querySelector(".jobs-description-content__text") ||
    document.querySelector("[class*='jobs-description']");

  let description = cleanText(descriptionEl);

  // Fallback: grab the largest text block under “About the job”
  if (!description || description.length < 100) {
    const aboutHeading = Array.from(document.querySelectorAll("h2, h3")).find(
      (h) => /about the job/i.test(h.innerText)
    );
    if (aboutHeading) {
      let sibling = aboutHeading.nextElementSibling;
      const parts = [];
      while (sibling && parts.join(" ").length < 8000) {
        const t = cleanText(sibling);
        if (t) parts.push(t);
        sibling = sibling.nextElementSibling;
      }
      if (parts.length) description = parts.join("\n\n");
    }
  }

  return {
    source: "linkedin",
    title,
    company,
    location,
    description,
    url: window.location.href
  };
}

function extractIndeed() {
  const title =
    cleanText(document.querySelector("[data-testid='jobsearch-JobInfoHeader-title']")) ||
    cleanText(document.querySelector("h1.jobsearch-JobInfoHeader-title")) ||
    cleanText(document.querySelector("h1"));

  const company =
    cleanText(document.querySelector("[data-testid='inlineHeader-companyName'] a")) ||
    cleanText(document.querySelector("[data-testid='inlineHeader-companyName']")) ||
    cleanText(document.querySelector(".jobsearch-InlineCompanyRating div"));

  const location =
    cleanText(document.querySelector("[data-testid='job-location']")) ||
    cleanText(document.querySelector(".jobsearch-JobInfoHeader-subtitle > div:last-child"));

  const descriptionEl =
    document.querySelector("#jobDescriptionText") ||
    document.querySelector(".jobsearch-jobDescriptionText");

  return {
    source: "indeed",
    title,
    company,
    location,
    description: cleanText(descriptionEl),
    url: window.location.href
  };
}

function extractGeneric() {
  // Fallback for company career pages, Greenhouse, Lever, Workday, etc.
  const title =
    cleanText(document.querySelector("h1")) ||
    cleanText(document.querySelector("[class*='job-title']")) ||
    cleanText(document.querySelector("[class*='JobTitle']"));

  const company =
    cleanText(document.querySelector("[class*='company']")) ||
    document.querySelector('meta[property="og:site_name"]')?.content ||
    window.location.hostname.replace("www.", "").split(".")[0];

  // Try to grab the largest text block that looks like a description
  const possibleDesc = Array.from(
    document.querySelectorAll("div, section, article")
  )
    .map((el) => ({ el, len: cleanText(el).length }))
    .filter((x) => x.len > 400 && x.len < 15000)
    .sort((a, b) => b.len - a.len)[0];

  return {
    source: "generic",
    title,
    company,
    location: "",
    description: possibleDesc ? cleanText(possibleDesc.el) : "",
    url: window.location.href
  };
}

function extractJob() {
  const host = window.location.hostname;

  if (host.includes("linkedin.com")) {
    return extractLinkedIn();
  }
  if (host.includes("indeed.com")) {
    return extractIndeed();
  }
  return extractGeneric();
}

// Listen for requests from the side panel / background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_JOB") {
    try {
      const job = extractJob();
      sendResponse({ success: true, job });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }
  return true;
});

console.log("JobTailor AI content script loaded on", window.location.hostname);
