import { validateMatchSets, setWins, winnerOf, matchPoints } from "./scoring.js?v=20260925-two-sets";

const EVENT = {
  id: "tondu-ryder-cup-2026",
  fixtures: [
    { id: "F1", a: "Gar Lind & Gatty", aCaptain: true, b: "Warwick & Nathan" },
    { id: "F2", a: "Fitzy & Hayes", b: "Terry & Ollie" },
    { id: "F3", a: "Woolls & Hursty", b: "Liam & Grabs", bCaptain: true },
    { id: "F4", a: "Browny & Sanjay", b: "Harri & Bish" },
    { id: "F5", a: "Luke & James", b: "Murphy & O'Neill" },
    { id: "F6", a: "Parry & Tim", b: "Tatch & Hywel" },
    { id: "F7", a: "Tilley & Penny", b: "Steve & Farnham" },
    { id: "F8", a: "Warner & Hughsey", b: "Abbers & Davies" }
  ]
};

const appConfig = window.RYDER_CUP_CONFIG || {};
const PREVIEW_STORAGE_KEY = "tondu-ryder-cup-preview-v2";
const state = {
  results: {},
  lastUpdated: null,
  admin: false,
  user: null,
  preview: appConfig.mode === "preview",
  connected: false,
  backend: null,
  activeFixture: null
};

const els = {
  fixtures: document.querySelector("#fixtures"),
  scoreA: document.querySelector("#scoreA"),
  scoreB: document.querySelector("#scoreB"),
  playedCount: document.querySelector("#playedCount"),
  pointTrack: document.querySelector("#pointTrack"),
  scoreCall: document.querySelector("#scoreCall"),
  lastUpdated: document.querySelector("#lastUpdated"),
  adminEntry: document.querySelector("#adminEntry"),
  adminStrip: document.querySelector("#adminStrip"),
  adminIdentity: document.querySelector("#adminIdentity"),
  syncStatus: document.querySelector("#syncStatus"),
  adminExit: document.querySelector("#adminExit"),
  authDialog: document.querySelector("#authDialog"),
  authNote: document.querySelector("#authNote"),
  passcodeForm: document.querySelector("#passcodeForm"),
  passcode: document.querySelector("#passcode"),
  scoreDialog: document.querySelector("#scoreDialog"),
  scoreForm: document.querySelector("#scoreForm"),
  scoreFixtureLabel: document.querySelector("#scoreFixtureLabel"),
  scoreTeamA: document.querySelector("#scoreTeamA"),
  scoreTeamB: document.querySelector("#scoreTeamB"),
  scoreError: document.querySelector("#scoreError"),
  clearResult: document.querySelector("#clearResult"),
  toast: document.querySelector("#toast")
};

function hasFirebaseConfig(config) {
  return Boolean(config?.apiKey && config?.databaseURL && !String(config.apiKey).includes("REPLACE"));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function captainLabel(isCaptain) {
  return isCaptain ? '<span class="captain">CAPTAIN</span>' : "";
}

function formatSets(result) {
  if (!result?.sets?.length) return "Full score to follow";
  return result.sets.map((set, index) => `<span><small>S${index + 1}</small>${set.a}–${set.b}</span>`).join("");
}

function formatDate(value) {
  if (!value) return "Awaiting first result";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Awaiting first result";
  return `Last updated ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date)}`;
}

function renderFixtures() {
  els.fixtures.innerHTML = EVENT.fixtures.map((fixture, index) => {
    const result = state.results[fixture.id];
    const wins = setWins(result?.sets || []);
    const outcome = winnerOf(result?.sets || []);
    return `
      <article class="fixture ${outcome ? "is-complete" : ""} ${outcome === "draw" ? "is-draw" : ""}" data-fixture="${fixture.id}">
        <div class="fixture-head">
          <span class="fixture-number">Match ${index + 1}</span>
          <span class="fixture-status">${outcome === "draw" ? "Halved" : outcome ? "Complete" : "To play"}</span>
        </div>
        <div class="pair-row pair-a ${outcome === "a" ? "is-winner" : ""}">
          <span class="side-tag">A</span>
          <span class="pair-name">${escapeHtml(fixture.a)}${captainLabel(fixture.aCaptain)}</span>
          <span class="set-total">${result ? wins.a : "—"}</span>
        </div>
        <div class="pair-row pair-b ${outcome === "b" ? "is-winner" : ""}">
          <span class="side-tag">B</span>
          <span class="pair-name">${escapeHtml(fixture.b)}${captainLabel(fixture.bCaptain)}</span>
          <span class="set-total">${result ? wins.b : "—"}</span>
        </div>
        <div class="fixture-foot">
          <span class="sets-line">${formatSets(result)}</span>
          ${state.admin
            ? `<button class="edit-result" type="button" data-edit="${fixture.id}">${result ? "Edit" : "Add result"}</button>`
            : `<span class="pending-label">${outcome === "draw" ? "0.5 points each" : outcome ? `1 point · ${outcome.toUpperCase()}’s` : "Result pending"}</span>`}
        </div>
      </article>`;
  }).join("");

  els.fixtures.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => openScoreDialog(button.dataset.edit));
  });
}

function renderScoreboard() {
  const outcomes = EVENT.fixtures.map(fixture => winnerOf(state.results[fixture.id]?.sets || []));
  const scores = EVENT.fixtures.reduce((total, fixture) => {
    const points = matchPoints(state.results[fixture.id]?.sets || []);
    total.a += points.a;
    total.b += points.b;
    return total;
  }, { a: 0, b: 0 });
  const played = outcomes.filter(Boolean).length;
  const { a: scoreA, b: scoreB } = scores;
  els.scoreA.textContent = scoreA;
  els.scoreB.textContent = scoreB;
  els.playedCount.textContent = `${played} of 8 played`;
  els.pointTrack.innerHTML = outcomes.map(outcome => `<span class="point-segment ${outcome || ""}" aria-hidden="true"></span>`).join("");
  els.lastUpdated.textContent = formatDate(state.lastUpdated);

  if (!played) els.scoreCall.textContent = "All to play for.";
  else if (played === 8 && scoreA === scoreB) els.scoreCall.textContent = "The cup finishes level.";
  else if (played === 8) els.scoreCall.textContent = `${scoreA > scoreB ? "The A’s" : "The B’s"} win the Ryder Cup.`;
  else if (scoreA === scoreB) els.scoreCall.textContent = `Level after ${played} ${played === 1 ? "match" : "matches"}.`;
  else els.scoreCall.textContent = `${scoreA > scoreB ? "The A’s" : "The B’s"} lead by ${Math.abs(scoreA - scoreB)}.`;
}

function renderAdmin() {
  els.adminStrip.hidden = !state.admin;
  els.adminIdentity.textContent = state.preview ? "Preview organiser mode" : "Organiser mode";
  els.syncStatus.textContent = state.preview ? "Saved on this device" : (state.connected ? "Live and connected" : "Offline — changes may not save");
  els.adminExit.textContent = state.preview ? "Exit organiser mode" : "Sign out";
}

function render() {
  renderScoreboard();
  renderAdmin();
  renderFixtures();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

function openScoreDialog(fixtureId) {
  const fixture = EVENT.fixtures.find(item => item.id === fixtureId);
  if (!fixture || !state.admin) return;
  state.activeFixture = fixtureId;
  els.scoreFixtureLabel.textContent = `Match ${EVENT.fixtures.indexOf(fixture) + 1}`;
  els.scoreTeamA.textContent = fixture.a;
  els.scoreTeamB.textContent = fixture.b;
  els.scoreError.textContent = "";
  const sets = state.results[fixtureId]?.sets || [];
  for (let index = 0; index < 2; index += 1) {
    els.scoreForm.elements[`set${index + 1}A`].value = sets[index]?.a ?? "";
    els.scoreForm.elements[`set${index + 1}B`].value = sets[index]?.b ?? "";
  }
  els.clearResult.hidden = !state.results[fixtureId];
  els.scoreDialog.showModal();
  els.scoreForm.elements.set1A.focus();
}

function readSet(number) {
  const rawA = els.scoreForm.elements[`set${number}A`].value.trim();
  const rawB = els.scoreForm.elements[`set${number}B`].value.trim();
  if (!rawA && !rawB) return null;
  if (!rawA || !rawB) throw new Error(`Enter both scores for set ${number}.`);
  return { a: Number(rawA), b: Number(rawB) };
}

async function saveResult(fixtureId, result) {
  if (state.preview) {
    state.results[fixtureId] = result;
    state.lastUpdated = Date.now();
    localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify({ results: state.results, lastUpdated: state.lastUpdated }));
    render();
    return;
  }
  await state.backend.save(fixtureId, result);
}

async function clearResult(fixtureId) {
  if (state.preview) {
    delete state.results[fixtureId];
    state.lastUpdated = Date.now();
    localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify({ results: state.results, lastUpdated: state.lastUpdated }));
    render();
    return;
  }
  await state.backend.clear(fixtureId);
}

els.scoreForm.addEventListener("submit", async event => {
  event.preventDefault();
  els.scoreError.textContent = "";
  try {
    const sets = [readSet(1), readSet(2)].filter(Boolean);
    const validation = validateMatchSets(sets);
    if (!validation.valid) throw new Error(validation.error);
    const result = { sets, winner: validation.winner };
    await saveResult(state.activeFixture, result);
    closeDialog(els.scoreDialog);
    showToast("Result saved");
  } catch (error) {
    els.scoreError.textContent = error.message || "The result could not be saved.";
  }
});

els.clearResult.addEventListener("click", async () => {
  if (!state.activeFixture || !window.confirm("Clear this result? The match will return to ‘To play’.")) return;
  try {
    await clearResult(state.activeFixture);
    closeDialog(els.scoreDialog);
    showToast("Result cleared");
  } catch (error) {
    els.scoreError.textContent = error.message || "The result could not be cleared.";
  }
});

els.adminEntry.addEventListener("click", () => {
  if (state.preview) {
    state.admin = true;
    render();
    showToast("Preview organiser mode enabled");
    return;
  }
  if (state.admin) {
    document.querySelector(".fixtures-section")?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  if (!state.backend) {
    showToast("Organiser access is temporarily unavailable");
    return;
  }
  els.authDialog.showModal();
});

els.adminExit.addEventListener("click", async () => {
  if (state.preview) {
    state.admin = false;
    render();
    return;
  }
  if (state.backend) await state.backend.signOut();
});

document.querySelectorAll("[data-close-dialog]").forEach(button => {
  button.addEventListener("click", () => closeDialog(document.querySelector(`#${button.dataset.closeDialog}`)));
});

[els.authDialog, els.scoreDialog].forEach(dialog => {
  dialog.addEventListener("click", event => {
    if (event.target === dialog) closeDialog(dialog);
  });
});

function loadPreviewData() {
  try {
    const stored = JSON.parse(localStorage.getItem(PREVIEW_STORAGE_KEY) || "null");
    if (stored?.results) state.results = stored.results;
    if (stored?.lastUpdated) state.lastUpdated = stored.lastUpdated;
  } catch {
    localStorage.removeItem(PREVIEW_STORAGE_KEY);
  }
}

async function connectFirebase() {
  const [{ initializeApp }, authModule, dbModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js")
  ]);
  const firebaseApp = initializeApp(appConfig.firebase);
  const auth = authModule.getAuth(firebaseApp);
  const db = dbModule.getDatabase(firebaseApp);
  const eventPath = `events/${EVENT.id}`;

  dbModule.onValue(dbModule.ref(db, eventPath), snapshot => {
    const data = snapshot.val() || {};
    state.results = data.results || {};
    state.lastUpdated = data.lastUpdated || null;
    render();
  }, () => showToast("Live results are temporarily unavailable"));

  dbModule.onValue(dbModule.ref(db, ".info/connected"), snapshot => {
    state.connected = snapshot.val() === true;
    renderAdmin();
  });

  state.backend = {
    async save(fixtureId, result) {
      if (!state.admin || !state.user) throw new Error("Sign in as the organiser before saving.");
      await dbModule.update(dbModule.ref(db, eventPath), {
        [`results/${fixtureId}`]: {
          sets: result.sets,
          winner: result.winner,
          updatedAt: dbModule.serverTimestamp(),
          updatedBy: state.user.uid
        },
        lastUpdated: dbModule.serverTimestamp()
      });
    },
    async clear(fixtureId) {
      if (!state.admin || !state.user) throw new Error("Sign in as the organiser before clearing a result.");
      await dbModule.update(dbModule.ref(db, eventPath), {
        [`results/${fixtureId}`]: null,
        lastUpdated: dbModule.serverTimestamp()
      });
    },
    signOut: () => authModule.signOut(auth)
  };

  authModule.onAuthStateChanged(auth, async user => {
    state.user = user;
    state.admin = false;
    if (user) {
      try {
        const adminSnapshot = await dbModule.get(dbModule.ref(db, `admins/${user.uid}`));
        state.admin = adminSnapshot.val() === true;
        if (!state.admin) {
          els.authNote.textContent = "This account has not been approved as the organiser.";
          els.authDialog.showModal();
        } else {
          closeDialog(els.authDialog);
        }
      } catch {
        els.authNote.textContent = "Organiser access could not be verified.";
      }
    }
    render();
  });

  els.passcodeForm.addEventListener("submit", async event => {
    event.preventDefault();
    els.authNote.textContent = "";
    try {
      await authModule.signInWithEmailAndPassword(auth, appConfig.organiserEmail, els.passcode.value);
      els.passcodeForm.reset();
    } catch (error) {
      els.authNote.textContent = "That passcode did not unlock score editing. Please try again.";
    }
  });
}

function registerWebMcpTool() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const fixtures = EVENT.fixtures.map(fixture => fixture.id);
  try {
    void Promise.resolve(context.registerTool({
      name: "record_fixture_result",
      title: "Record fixture result",
      description: "Save a completed two-set Tondu Ryder Cup match. A 1–1 split awards 0.5 points to each side. Organiser access is required.",
      inputSchema: {
        type: "object",
        properties: {
          fixtureId: { type: "string", enum: fixtures },
          sets: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: {
              type: "object",
              properties: { a: { type: "integer", minimum: 0 }, b: { type: "integer", minimum: 0 } },
              required: ["a", "b"],
              additionalProperties: false
            }
          }
        },
        required: ["fixtureId", "sets"],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (!state.admin) throw new Error("Organiser access is required.");
        if (!fixtures.includes(input?.fixtureId)) throw new Error("Unknown fixture.");
        const validation = validateMatchSets(input?.sets);
        if (!validation.valid) throw new Error(validation.error);
        await saveResult(input.fixtureId, { sets: input.sets, winner: validation.winner });
        return { fixtureId: input.fixtureId, winner: validation.winner, saved: true };
      }
    })).catch(() => {});
  } catch {
    // WebMCP is optional and unsupported browsers simply use the visible interface.
  }
}

if (state.preview) {
  loadPreviewData();
  els.authNote.textContent = "Preview mode is active until Firebase is connected.";
} else if (!hasFirebaseConfig(appConfig.firebase)) {
  showToast("Live results are not configured yet");
} else {
  connectFirebase().catch(() => showToast("Live results are temporarily unavailable"));
}

render();
registerWebMcpTool();
