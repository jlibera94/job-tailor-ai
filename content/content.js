/**
 * JobTailor AI — Content Script
 * Extracts job title, company, location, description and requirements
 * from common job boards and generic career pages.
 */

function cleanText(el) {
  if (!el) return "";
  const text = el.innerText || el.textContent || el.getAttribute("aria-label") || "";
  return String(text).replace(/\s+/g, " ").trim();
}

function findTextFromSelectors(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const text = cleanText(el);
    if (text) return text;
  }
  return "";
}

function extractLinkedIn() {
  const title =
    findTextFromSelectors([
      ".job-details-jobs-unified-top-card__job-title h1",
      ".job-details-jobs-unified-top-card__job-title",
      "h1.job-title",
      "h1.t-24",
      "h1",
      "[class*='job-title']",
      "[class*='jobTitle']",
      "[data-automation-id*='job-title']"
    ]) ||
    Array.from(document.querySelectorAll("h1, h2, [class*='job-title'], [class*='jobTitle']"))
      .map(cleanText)
      .find((text) => text && text.length < 200 && !/apply|saved|linkedin/i.test(text)) ||
    "";

  const company =
    findTextFromSelectors([
      ".job-details-jobs-unified-top-card__company-name a",
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name a",
      ".jobs-unified-top-card__company-name",
      "a[data-tracking-control-name*='company']",
      "[class*='company-name']",
      "[class*='companyName']",
      "[data-company-name]"
    ]) ||
    document.querySelector('meta[property="og:site_name"]')?.content ||
    "";

  const location =
    findTextFromSelectors([
      ".job-details-jobs-unified-top-card__primary-description-container",
      ".job-details-jobs-unified-top-card__bullet",
      ".jobs-unified-top-card__bullet",
      ".tvm__text--low-emphasis",
      "[class*='location']",
      "[data-automation-id*='location']",
      "[class*='job-location']"
    ]) ||
    "";

  const descriptionEl =
    document.querySelector("#job-details") ||
    document.querySelector(".jobs-description__content") ||
    document.querySelector(".jobs-box__html-content") ||
    document.querySelector(".description__text") ||
    document.querySelector(".jobs-description-content__text") ||
    document.querySelector("[class*='jobs-description']") ||
    Array.from(document.querySelectorAll("div, article, section, p"))
      .find((el) => /about the job/i.test(cleanText(el))) ||
    null;

  let description = cleanText(descriptionEl);

  if (!description || description.length < 100) {
    const aboutHeading = Array.from(document.querySelectorAll("h2, h3")).find((h) => /about the job/i.test(cleanText(h)));
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

  if (!description) {
    const bodyText = cleanText(document.body);
    const aboutIndex = bodyText.search(/about the job/i);
    if (aboutIndex >= 0) {
      description = bodyText.slice(aboutIndex, aboutIndex + 1800).trim();
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
