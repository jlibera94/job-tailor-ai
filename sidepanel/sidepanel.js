/**
 * JobTailor AI — Side Panel Logic
 */

// ---------- DOM helpers ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function show(el) {
  el?.classList.remove("hidden");
}
function hide(el) {
  el?.classList.add("hidden");
}

// ---------- State ----------
let currentJob = null;
let masterCV = null;
let lastResult = null;

// ---------- Tabs ----------
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => t.classList.remove("active"));
    $$(".tab-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    $(`#tab-${tab.dataset.tab}`).classList.add("active");
  });
});

// ---------- Load saved CV on startup ----------
chrome.runtime.sendMessage({ type: "GET_MASTER_CV" }, (cv) => {
  if (cv) {
    masterCV = cv;
    updateCVStatus();
  }
});

function updateCVStatus() {
  const status = $("#cv-status");
  if (masterCV) {
    status.textContent = `✓ Master CV saved (${masterCV.name || "Unnamed"} · ${masterCV.text?.length || 0} chars)`;
    status.className = "status success";
    if (masterCV.text) {
      $("#cv-text").value = masterCV.text;
    }
  } else {
    status.textContent = "No master CV uploaded yet.";
    status.className = "status muted";
  }
  updateGenerateButton();
}

// ---------- Upload / Save CV ----------
$("#btn-upload").addEventListener("click", () => {
  $("#cv-file").click();
});

$("#cv-file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // For MVP we only support plain text extraction from .txt.
  // PDF/DOCX parsing will be added later (pdf.js / mammoth).
  if (file.name.endsWith(".txt") || file.type === "text/plain") {
    const text = await file.text();
    $("#cv-text").value = text;
  } else {
    alert(
      "For this MVP, please paste the text of your resume into the text box.\n\nFull PDF/DOCX parsing will be added in the next iteration."
    );
  }
});

$("#btn-save-cv").addEventListener("click", () => {
  const text = $("#cv-text").value.trim();
  if (!text) {
    alert("Please paste or upload resume text first.");
    return;
  }

  // Very light parsing for name (first non-empty line)
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const name = lines[0] || "Unknown";

  masterCV = {
    name,
    text,
    location: "Montreal, QC", // can be improved later
    savedAt: new Date().toISOString()
  };

  chrome.runtime.sendMessage({ type: "SAVE_MASTER_CV", payload: masterCV }, () => {
    updateCVStatus();
    alert("Master CV saved locally.");
  });
});

// ---------- Scan Job ----------
$("#btn-scan").addEventListener("click", () => {
  const status = $("#job-status");
  status.textContent = "Scanning current page…";
  status.className = "status muted";
  hide($("#job-details"));

  chrome.runtime.sendMessage({ type: "EXTRACT_JOB" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      status.textContent = "Could not reach the page. Make sure you are on a job posting and refresh the tab.";
      status.className = "status error";
      currentJob = null;
      updateGenerateButton();
      return;
    }

    if (!response.success || !response.job) {
      status.textContent = response.error || "Failed to extract job details.";
      status.className = "status error";
      currentJob = null;
      updateGenerateButton();
      return;
    }

    currentJob = response.job;
    status.textContent = `✓ Detected from ${currentJob.source}`;
    status.className = "status success";

    $("#job-title").textContent = currentJob.title || "—";
    $("#job-company").textContent = currentJob.company || "—";
    $("#job-location").textContent = currentJob.location || "—";
    $("#job-description").textContent =
      (currentJob.description || "").slice(0, 600) +
      (currentJob.description?.length > 600 ? "…" : "");

    show($("#job-details"));
    updateGenerateButton();
  });
});

function updateGenerateButton() {
  const btn = $("#btn-generate");
  btn.disabled = !(currentJob && masterCV);
}

// ---------- Generate ----------
$("#btn-generate").addEventListener("click", () => {
  const btn = $("#btn-generate");
  btn.disabled = true;
  btn.textContent = "Generating…";

  chrome.runtime.sendMessage(
    {
      type: "GENERATE_APPLICATION",
      payload: { job: currentJob, masterCV }
    },
    (result) => {
      btn.disabled = false;
      btn.textContent = "Generate Tailored Application";

      if (!result) {
        alert("Generation failed. Check the service worker console.");
        return;
      }

      lastResult = result;
      renderResults(result);

      // Switch to Results tab
      $$(".tab").forEach((t) => t.classList.remove("active"));
      $$(".tab-panel").forEach((p) => p.classList.remove("active"));
      $('[data-tab="result"]').classList.add("active");
      $("#tab-result").classList.add("active");
    }
  );
});

function renderResults(result) {
  hide($("#result-empty"));
  show($("#result-content"));

  // Score
  $("#match-score").textContent = result.matchScore ?? "–";

  // Analysis
  const list = $("#analysis-list");
  list.innerHTML = "";
  (result.analysis || []).forEach((item) => {
    const div = document.createElement("div");
    div.className = "analysis-item";
    div.innerHTML = `
      <span class="badge ${item.status}">${item.status}</span>
      <div>
        <div class="req">${item.requirement}</div>
        <div class="evidence">${item.evidence}</div>
      </div>
    `;
    list.appendChild(div);
  });

  // Resume preview
  const resume = result.tailoredResume;
  let resumeHtml = "";
  if (resume) {
    resumeHtml += `<strong>${resume.name || ""}</strong>\n`;
    resumeHtml += `${resume.location || ""} · ${resume.title || ""}\n\n`;
    resumeHtml += `Professional Summary\n${resume.summary || ""}\n\n`;
    (resume.experience || []).forEach((exp) => {
      resumeHtml += `${exp.role} — ${exp.company}\n${exp.period}\n`;
      (exp.bullets || []).forEach((b) => {
        resumeHtml += `• ${b}\n`;
      });
      resumeHtml += "\n";
    });
  }
  $("#resume-preview").textContent = resumeHtml.trim();

  // Cover letter
  $("#letter-preview").textContent = result.coverLetter || "";
}

// ---------- Copy buttons ----------
$("#btn-copy-resume")?.addEventListener("click", () => {
  const text = $("#resume-preview").textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = $("#btn-copy-resume");
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = "Copy"), 1500);
  });
});

$("#btn-copy-letter")?.addEventListener("click", () => {
  const text = $("#letter-preview").textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = $("#btn-copy-letter");
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = "Copy"), 1500);
  });
});

console.log("JobTailor AI side panel ready");
