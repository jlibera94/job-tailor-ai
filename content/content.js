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

function getMetaContent(...names) {
  const metaEntries = Array.from(document.querySelectorAll("meta"));
  const values = [];

  for (const meta of metaEntries) {
    const property = meta.getAttribute("property") || meta.getAttribute("name") || "";
    const content = meta.getAttribute("content") || "";
    if (property && content) values.push({ property, content });
  }

  for (const name of names) {
    const match = values.find((entry) => entry.property === name || entry.property === name.replace(/^og:/, ""));
    if (match && match.content.trim()) return match.content.trim();
  }

  if (names.includes("title") && document.title) return document.title.trim();
  return "";
}

function looksLikeJobTitle(text) {
  if (!text) return false;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > 220) return false;
  if (/^(0\s+notifications|notifications|sign in|learn more|apply now|join our team|menu)$/i.test(cleaned)) {
    return false;
  }
  return /(?:engineer|manager|analyst|developer|designer|architect|specialist|lead|associate|director|consultant|success|product|research|scientist|recruiter|coordinator|advisor)/i.test(cleaned);
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
  const metaTitle = getMetaContent("og:title", "twitter:title", "title");
  const headingTitle = Array.from(document.querySelectorAll("h1, h2, h3, [class*='job-title'], [class*='JobTitle']"))
    .map((el) => cleanText(el))
    .find((text) => looksLikeJobTitle(text));

  const title =
    (metaTitle && looksLikeJobTitle(metaTitle) ? metaTitle : "") ||
    (document.title && looksLikeJobTitle(document.title) ? document.title.split("|")[0].trim() : "") ||
    headingTitle ||
    "";

  const company =
    getMetaContent("og:site_name", "twitter:site") ||
    cleanText(document.querySelector("[class*='company']")) ||
    window.location.hostname.replace("www.", "").split(".")[0];

  // Try to grab the largest text block that looks like a description, but skip obvious nav/header noise
  const possibleDesc = Array.from(
    document.querySelectorAll("div, section, article, main")
  )
    .map((el) => ({ el, len: cleanText(el).length }))
    .filter((x) => {
      const text = cleanText(x.el);
      return text.length > 400 && text.length < 15000 && !/^(0\s+notifications|notifications|sign in)$/i.test(text);
    })
    .sort((a, b) => b.len - a.len)[0];

  const description = possibleDesc ? cleanText(possibleDesc.el) : "";

  return {
    source: "generic",
    title,
    company,
    location: "",
    description,
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
