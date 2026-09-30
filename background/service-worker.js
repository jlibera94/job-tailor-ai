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

function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function extractResumeFacts(masterCV = {}) {
  const text = normalizeText(masterCV.text || "");
  const lines = (masterCV.text || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const name = masterCV.name || lines[0] || "Candidate";

  const skills = Array.from(new Set(
    (text.match(/[A-Za-z][A-Za-z+.#/() -]{2,}/g) || [])
      .filter((token) => token.length > 2)
      .slice(0, 30)
  ));

  return { name, text, lines, skills };
}

function scoreRequirement(resumeText, requirement, keywords) {
  const lower = resumeText.toLowerCase();
  const hits = keywords.filter((keyword) => lower.includes(keyword.toLowerCase()));

  if (hits.length >= Math.max(1, Math.ceil(keywords.length / 2))) {
    return { status: "strong", evidence: `Resume aligns with ${requirement.toLowerCase()} (${hits.slice(0, 2).join(", ")})` };
  }

  if (hits.length >= 1) {
    return { status: "good", evidence: `Some overlap with ${requirement.toLowerCase()} through ${hits[0]}` };
  }

  return { status: "gap", evidence: `No clear evidence for ${requirement.toLowerCase()} in the current resume` };
}

function buildRequirementAnalysis(job, masterCV) {
  const resume = extractResumeFacts(masterCV);
  const jobText = normalizeText(job?.description || "");
  const jobTitle = normalizeText(job?.title || "the role");
  const company = normalizeText(job?.company || "the company");

  const requirements = [
    {
      requirement: "Customer-facing communication",
      keywords: ["customer", "support", "client", "relationship", "stakeholder", "communication"]
    },
    {
      requirement: "Technical troubleshooting",
      keywords: ["technical", "troubleshoot", "debug", "support", "issue", "root cause", "api", "integration"]
    },
    {
      requirement: "Cross-functional collaboration",
      keywords: ["cross-functional", "engineering", "product", "stakeholder", "accountability", "collaboration", "team"]
    },
    {
      requirement: "SaaS / product understanding",
      keywords: ["saas", "product", "customer success", "workflow", "platform", "software", "application"]
    },
    {
      requirement: "Documentation and process discipline",
      keywords: ["documentation", "jira", "process", "tracking", "testing", "reporting", "workflow"]
    }
  ];

  const analysis = requirements.map((item) => {
    const result = scoreRequirement(resume.text, item.requirement, item.keywords);
    return {
      requirement: item.requirement,
      status: result.status,
      evidence: `${result.evidence}. ${jobTitle} at ${company} likely values this capability.`
    };
  });

  if (!jobText) {
    analysis[0].evidence = `Resume includes customer-facing and communication language relevant to the role.`;
  }

  return analysis;
}

function parseResumeExperienceEntries(cvText = "") {
  const lines = cvText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const entries = [];
  let current = null;

  for (const line of lines) {
    const isBullet = /^[-•*]/.test(line);
    const isDate = /\d{4}/.test(line) || /Present|Current|Now|Today/i.test(line);
    const looksLikeRoleLine = /(?:engineer|developer|manager|analyst|specialist|lead|support|customer|consultant|associate|coordinator|advisor|architect)/i.test(line);

    if (!current && looksLikeRoleLine && !isDate && !isBullet) {
      current = { role: line, company: "", period: "", bullets: [] };
      continue;
    }

    if (current && !isBullet && isDate) {
      current.period = line;
      continue;
    }

    if (current && isBullet) {
      current.bullets.push(line.replace(/^[-•*]\s*/, ""));
      continue;
    }

    if (current && !isBullet && !isDate && !looksLikeRoleLine) {
      if (!current.company && current.role) {
        const parts = line.split(/\s*[-–—|]\s*/).filter(Boolean);
        if (parts.length > 1 && !/\d{4}/.test(line)) {
          current.company = parts[parts.length - 1];
        }
      }
      continue;
    }

    if (current && !looksLikeRoleLine) {
      if (current.company && !current.period) {
        current.period = line;
      }
    }

    if (current && (!isBullet && !isDate && !looksLikeRoleLine) && current.company && current.period) {
      entries.push(current);
      current = null;
    }
  }

  if (current && current.role) {
    entries.push(current);
  }

  return entries
    .map((entry) => {
      const roleParts = entry.role.split(/\s*[-–—|]\s*/).filter(Boolean);
      if (roleParts.length > 1 && !entry.company) {
        return {
          ...entry,
          role: roleParts[0],
          company: roleParts.slice(1).join(" ")
        };
      }

      if (!entry.company && entry.role.includes(" at ")) {
        const [role, companyPart] = entry.role.split(/\s+at\s+/i);
        return { ...entry, role, company: companyPart };
      }

      return {
        ...entry,
        company: entry.company || "Previous Company",
        role: entry.role || "Professional",
        bullets: entry.bullets.length ? entry.bullets : [
          "Supported customers and stakeholders to resolve issues quickly and document follow-up actions.",
          "Collaborated with internal teams to improve product and service outcomes."
        ],
        period: entry.period || "Recent experience"
      };
    })
    .slice(0, 3);
}

function buildTailoredResume(job, masterCV) {
  const resume = extractResumeFacts(masterCV);
  const jobTitle = normalizeText(job?.title || "Customer Success / Technical Role");
  const company = normalizeText(job?.company || "the company");
  const location = masterCV?.location || "Remote";

  const parsedEntries = parseResumeExperienceEntries(resume.text);
  const experience = parsedEntries.length
    ? parsedEntries.map((entry) => ({
        company: entry.company,
        role: entry.role,
        period: entry.period,
        bullets: entry.bullets
      }))
    : [{
        company: "Previous Company",
        role: "Senior Professional",
        period: "Recent experience",
        bullets: [
          "Partnered with customers and internal stakeholders to resolve issues, improve experience, and maintain strong relationships.",
          "Used technical knowledge and process discipline to troubleshoot customer-reported problems and coordinate follow-up actions.",
          "Worked cross-functionally with product, engineering, and support teams to deliver customer-focused outcomes.",
          "Documented issues, tracked progress, and communicated clearly to both technical and non-technical stakeholders."
        ]
      }];

  const summary = `Customer-focused professional with experience in technical support, issue investigation, relationship management, and cross-functional execution. Brings a strong blend of communication, problem-solving, and product understanding to support customers, resolve issues quickly, and help deliver a high-quality experience for clients and internal teams. Ready to contribute to ${company} in the ${jobTitle} role.`;

  return {
    name: resume.name,
    location,
    title: jobTitle,
    summary,
    experience,
    originalText: masterCV?.text || ""
  };
}

function buildCoverLetter(job, masterCV) {
  const jobTitle = normalizeText(job?.title || "the role");
  const company = normalizeText(job?.company || "the company");
  const resume = extractResumeFacts(masterCV);
  const summaryLead = resume.text.length > 200
    ? "My background combines customer-facing communication, technical troubleshooting, and strong documentation habits with a service mindset."
    : "I bring a strong mix of customer communication, technical troubleshooting, and cross-functional execution to this opportunity.";

  return `Dear ${company} Hiring Team,

I am excited to apply for the ${jobTitle} position at ${company}. ${summaryLead} I enjoy helping customers succeed, solving complex issues, and working closely with internal teams to deliver a better experience for users.

In my recent experience, I have supported customers and stakeholders by understanding their needs, troubleshooting technical issues, and coordinating cross-functional follow-up to resolve problems efficiently. I am comfortable working with both technical and non-technical audiences, documenting solutions clearly, and helping teams improve operational consistency and customer satisfaction.

I am particularly drawn to this opportunity because it combines customer impact, problem solving, and collaboration across teams. I would welcome the chance to bring my communication skills, technical foundation, and service mindset to ${company} and help the team deliver a best-in-class customer experience.

Thank you for your time and consideration. I look forward to the opportunity to discuss how my background aligns with the needs of the team and the goals of the business.

Sincerely,
${resume.name}`;
}

/**
 * Mock AI generation — replace with real OpenAI / backend call later
 */
async function handleGenerate({ job, masterCV }) {
  await new Promise((r) => setTimeout(r, 1200));

  const jobTitle = normalizeText(job?.title || "the role");
  const company = normalizeText(job?.company || "the company");
  const analysis = buildRequirementAnalysis(job, masterCV);
  const tailoredResume = buildTailoredResume(job, masterCV);
  const coverLetter = buildCoverLetter(job, masterCV);
  const matchScore = analysis.filter((item) => item.status === "strong").length * 20 + analysis.filter((item) => item.status === "good").length * 10;

  return {
    matchScore: Math.min(96, Math.max(60, matchScore)),
    analysis,
    tailoredResume,
    coverLetter,
    company,
    jobTitle
  };
}

console.log("JobTailor AI service worker loaded");
