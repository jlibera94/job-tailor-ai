/**
 * JobTailor AI — Background Service Worker (Manifest V3)
 */

// Open the side panel when the extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Allow the side panel to open on any site (user can still restrict later)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Listen for messages from content script or side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_JOB") {
    extractJobFromActiveTab().then(sendResponse).catch((err) => {
      sendResponse({ success: false, error: err.message || String(err) });
    });
    return true; // keep channel open for async response
  }

  if (message.type === "GET_MASTER_CV") {
    chrome.storage.local.get(["masterCV"], (result) => {
      sendResponse(result.masterCV || null);
    });
    return true;
  }

  if (message.type === "SAVE_MASTER_CV") {
    chrome.storage.local.set({ masterCV: message.payload }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "GENERATE_APPLICATION") {
    // For MVP we do a simple mock. Later this will call a real backend.
    handleGenerate(message.payload).then(sendResponse);
    return true;
  }
});

/**
 * Inject content script if needed, then ask it to extract the job.
 * This fixes "Receiving end does not exist" on SPAs and after extension reload.
 */
async function extractJobFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { success: false, error: "No active tab found" };
  }

  // Skip chrome:// and other restricted pages
  if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
    return { success: false, error: "Cannot scan this type of page. Open a job posting first." };
  }

  // Always inject (or re-inject) the content script so the listener exists
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content/content.js"]
    });
  } catch (err) {
    // Injection can fail on restricted pages; surface a clear message
    return {
      success: false,
      error: "Could not inject scanner into this page. Try refreshing the tab, then click Scan again."
    };
  }

  // Small delay so the content script's listener is registered
  await new Promise((r) => setTimeout(r, 100));

  // Now message it
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB" });
    return response;
  } catch (err) {
    return {
      success: false,
      error: err.message || "Could not talk to the page scanner. Refresh the tab and try again."
    };
  }
}

/**
 * Mock AI generation — replace with real OpenAI / backend call later
 */
async function handleGenerate({ job, masterCV }) {
  // Simulate network latency
  await new Promise((r) => setTimeout(r, 1200));

  const jobTitle = job?.title || "the role";
  const company = job?.company || "the company";

  return {
    matchScore: 78,
    analysis: [
      {
        requirement: "Manual QA / testing experience",
        status: "strong",
        evidence: "WorkAxle – manual API & frontend testing, defect documentation in Jira"
      },
      {
        requirement: "API testing (REST / GraphQL)",
        status: "strong",
        evidence: "Postman experience validating REST and GraphQL endpoints"
      },
      {
        requirement: "Defect tracking & reproduction",
        status: "strong",
        evidence: "Detailed reproduction steps, expected vs actual results in Jira"
      },
      {
        requirement: "Agile / collaboration with engineering",
        status: "good",
        evidence: "Participated in Agile ceremonies and fix validation with developers"
      },
      {
        requirement: "3–5 years dedicated QA experience",
        status: "gap",
        evidence: "Relevant testing work exists but total dedicated QA years is lower"
      }
    ],
    tailoredResume: {
      name: masterCV?.name || "Jan Libera",
      location: masterCV?.location || "Montreal, QC",
      title: "Quality Assurance / Technical Support",
      summary: `Technical professional with hands-on experience in manual software testing, API validation, defect investigation and enterprise application support. Skilled in reproducing issues, documenting defects in Jira, testing REST and GraphQL APIs using Postman, and collaborating with engineering teams to validate fixes. Experienced in Agile environments, technical troubleshooting and customer-facing software support.`,
      experience: [
        {
          company: "WorkAxle",
          role: "Developer & Integration Specialist",
          period: "July 2025 – Present",
          bullets: [
            "Performed manual API and frontend testing to validate application functionality and identify defects.",
            "Tested REST APIs and GraphQL queries and mutations using Postman.",
            "Reproduced customer-reported issues, isolating problems across frontend, backend and integration layers.",
            "Documented defects in Jira with detailed reproduction steps, expected versus actual results and verification evidence.",
            "Collaborated with engineering teams to validate fixes and confirm issue resolution.",
            "Analyzed application logs using Grafana to investigate errors and integration failures.",
            "Participated in Agile development activities and contributed to improvements in testing coverage."
          ]
        }
        // Additional roles can be reordered / filtered by the real AI later
      ]
    },
    coverLetter: `Dear ${company} Hiring Team,

I'm interested in the ${jobTitle} position at ${company}. My background is in technical support, API testing, and software troubleshooting, and I've gained hands-on experience testing applications and working closely with development teams to identify and resolve defects.

In my current role at WorkAxle, I perform manual frontend and API testing, validate REST and GraphQL endpoints using Postman, and document bugs in Jira with detailed reproduction steps. I also work with engineering teams to verify fixes and investigate issues across different application layers.

Previously, I worked in Google Cloud technical support at TELUS International, where I developed strong troubleshooting, documentation, and customer communication skills.

I'm interested in bringing this experience to ${company}'s team, particularly its focus on application reliability, integration testing, and improving the user experience.

Thank you for considering my application.

Jan Libera`
  };
}

console.log("JobTailor AI service worker loaded");
