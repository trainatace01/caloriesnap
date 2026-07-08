/* ============ CalorieSnap app logic ============ */
(() => {
  const $ = id => document.getElementById(id);

  const HISTORY_KEY = "caloriesnap_history";
  const CUSTOM_KEY = "caloriesnap_custom_foods";

  /* ---------- custom foods (user-added via scan corrections) ---------- */
  let customFoods = (() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_KEY)) || []; }
    catch { return []; }
  })();

  function persistCustomFoods() {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customFoods)); }
    catch { toast("Storage full — couldn't save food"); }
  }

  function allFoods() { return FOODS.concat(customFoods); }
  function findFood(id) { return allFoods().find(f => f.id === id); }

  /* ---------- food images ---------- */
  const PLACEHOLDER_IMG = "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#e7e5e4"/><text x="60" y="55" font-size="34" text-anchor="middle">🍽️</text></svg>`);

  function foodImg(dish, alt) {
    const src = dish.img || PLACEHOLDER_IMG;
    return `<img src="${src}" alt="${alt || dish.name}" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">`;
  }

  /* ---------- state ---------- */
  let activeCategory = "All";
  let searchTerm = "";
  let pickerMode = false;          // library doubles as manual dish picker for scans
  let currentScan = null;          // { photo, dish, confidence, portionIdx }
  let modalState = null;           // { dish, portionIdx, fromScan }

  /* ---------- helpers ---------- */
  const round = n => Math.round(n);

  // Portion multiplies everything; cooking method multiplies calories & fat
  // (added oil), leaving protein/carbs as-is.
  function scaled(dish, portionIdx, prepIdx = 0) {
    const m = PORTIONS[portionIdx].mult;
    const prep = PREP_METHODS[prepIdx] || PREP_METHODS[0];
    return {
      calories: round(dish.calories * m * prep.mult),
      protein: round(dish.protein * m),
      carbs: round(dish.carbs * m),
      fat: round(dish.fat * m * prep.mult),
    };
  }

  function portionDesc(idx) {
    const p = PORTIONS[idx];
    return `${p.label} (×${p.mult.toFixed(2).replace(/0$/, "")})`;
  }

  /* ---------- visual portion cards ---------- */
  // Plate graphic with a food mound that grows with the portion size,
  // so users compare by eye instead of guessing what "Medium" means.
  function plateSVG(idx) {
    const r = [9, 14.5, 20][idx];
    return `<svg viewBox="0 0 60 60" aria-hidden="true">
      <circle cx="30" cy="30" r="26" fill="#ffffff" stroke="#d6d3d1" stroke-width="2"/>
      <circle cx="30" cy="30" r="21" fill="none" stroke="#e7e5e4" stroke-width="1.5"/>
      <circle cx="30" cy="30" r="${r}" fill="#f59e0b"/>
      <circle cx="${30 - r / 3}" cy="${30 - r / 3}" r="${r / 3}" fill="#fbbf24"/>
      <circle cx="${30 + r / 2.6}" cy="${30 + r / 4}" r="${r / 4.5}" fill="#d97706"/>
    </svg>`;
  }

  function renderPortionCards(containerId, selectedIdx) {
    $(containerId).innerHTML = PORTIONS.map((p, i) =>
      `<button type="button" class="portion-card${i === selectedIdx ? " active" : ""}" data-idx="${i}"
        aria-label="${p.label}" aria-pressed="${i === selectedIdx}">
        ${plateSVG(i)}
        <span class="portion-key">${p.name}</span>
        <span class="portion-cap">${p.caption}</span>
      </button>`
    ).join("");
  }

  // Wait until an <img> has finished loading (true = usable pixels).
  // Deliberately avoids img.decode(): its promise can stall forever when the
  // tab is backgrounded, which would freeze the scan flow.
  async function imageReady(img, timeoutMs = 5000) {
    const start = Date.now();
    while (!img.complete && Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 50));
    }
    return img.complete && img.naturalWidth > 0;
  }

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ---------- navigation ---------- */
  function showView(name) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    $("view-" + name).classList.add("active");
    document.querySelectorAll(".nav-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.view === name));
    if (name === "history") renderHistory();
    window.scrollTo({ top: 0 });
  }

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.view !== "library") exitPickerMode();
      showView(btn.dataset.view);
    });
  });

  /* ---------- library ---------- */
  function renderTabs() {
    const tabs = ["All", ...CATEGORIES];
    $("category-tabs").innerHTML = tabs.map(c =>
      `<button class="tab${c === activeCategory ? " active" : ""}" role="tab" data-cat="${c}">${c}</button>`
    ).join("");
    const active = $("category-tabs").querySelector(".tab.active");
    if (active) active.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }

  function stepCategory(dir) {
    const tabs = ["All", ...CATEGORIES];
    activeCategory = tabs[(tabs.indexOf(activeCategory) + dir + tabs.length) % tabs.length];
    renderTabs();
    renderGrid();
  }
  $("tab-prev").addEventListener("click", () => stepCategory(-1));
  $("tab-next").addEventListener("click", () => stepCategory(1));

  function filteredFoods() {
    const q = searchTerm.trim().toLowerCase();
    return allFoods().filter(f =>
      (activeCategory === "All" || f.category === activeCategory) &&
      (!q || f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q))
    );
  }

  function renderGrid() {
    const foods = filteredFoods();
    $("food-grid").innerHTML = foods.map(f =>
      `<button class="food-card" data-id="${f.id}" aria-label="${f.name}, ${f.calories} calories">
        <div class="food-card-img">${foodImg(f)}</div>
        <div class="food-card-body">
          <div class="food-card-name">${f.name}</div>
          <div class="food-card-cal">${f.calories} kcal</div>
        </div>
      </button>`
    ).join("");
    $("no-results").hidden = foods.length > 0;
  }

  $("category-tabs").addEventListener("click", e => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    activeCategory = tab.dataset.cat;
    renderTabs();
    renderGrid();
  });

  $("search-input").addEventListener("input", e => {
    searchTerm = e.target.value;
    renderGrid();
  });

  $("food-grid").addEventListener("click", e => {
    const card = e.target.closest(".food-card");
    if (!card) return;
    const dish = findFood(card.dataset.id);
    if (!dish) return;
    if (pickerMode) {
      applyManualPick(dish);
    } else {
      openModal(dish, false);
    }
  });

  /* ---------- manual picker mode ---------- */
  function enterPickerMode() {
    pickerMode = true;
    $("picker-banner").hidden = false;
    showView("library");
  }
  function exitPickerMode() {
    pickerMode = false;
    $("picker-banner").hidden = true;
  }
  $("btn-cancel-pick").addEventListener("click", () => {
    exitPickerMode();
    showView("scan");
  });

  function applyManualPick(dish) {
    exitPickerMode();
    if (currentScan) {
      currentScan.dish = dish;
      currentScan.confidence = null; // manually chosen
      currentScan.portionIdx = 1;
      currentScan.prepIdx = null; // ask how it was prepared
      showView("scan");
      renderScanResult();
    }
  }

  /* ---------- food modal (bottom sheet) ---------- */
  function openModal(dish, fromScan) {
    modalState = { dish, portionIdx: 1, fromScan };
    $("modal-name").textContent = dish.name;
    $("modal-category").textContent = dish.category;
    $("modal-image").innerHTML = foodImg(dish);
    $("modal-serving").textContent = dish.servingDesc ? "Typical serving: " + dish.servingDesc : "";
    $("modal-ingredients").innerHTML = ingredientChips(dish);
    $("modal-remove").hidden = !dish.custom;
    renderPortionCards("modal-portions", 1);
    // reset collapsible to closed
    $("modal-details").hidden = true;
    $("modal-details-toggle").setAttribute("aria-expanded", "false");
    updateModalNutrition();
    $("modal-backdrop").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    $("modal-backdrop").hidden = true;
    document.body.style.overflow = "";
    modalState = null;
  }

  function updateModalNutrition() {
    if (!modalState) return;
    const s = scaled(modalState.dish, modalState.portionIdx);
    $("modal-calories").textContent = s.calories;
    $("modal-protein").textContent = s.protein + "g";
    $("modal-carbs").textContent = s.carbs + "g";
    $("modal-fat").textContent = s.fat + "g";
    $("modal-portion-desc").textContent = portionDesc(modalState.portionIdx);
  }

  $("modal-portions").addEventListener("click", e => {
    const card = e.target.closest(".portion-card");
    if (!card || !modalState) return;
    modalState.portionIdx = +card.dataset.idx;
    renderPortionCards("modal-portions", modalState.portionIdx);
    updateModalNutrition();
  });

  $("modal-details-toggle").addEventListener("click", () => {
    const panel = $("modal-details");
    const open = panel.hidden;
    panel.hidden = !open;
    $("modal-details-toggle").setAttribute("aria-expanded", String(open));
  });

  $("modal-add").addEventListener("click", () => {
    if (!modalState) return;
    const s = scaled(modalState.dish, modalState.portionIdx);
    saveHistoryEntry({
      dishId: modalState.dish.id,
      name: modalState.dish.name,
      category: modalState.dish.category,
      portionIdx: modalState.portionIdx,
      prepIdx: 0,
      calories: s.calories,
      protein: s.protein, carbs: s.carbs, fat: s.fat,
      photo: null, // library entry — thumbnail uses the dish photo
      time: Date.now(),
    });
    closeModal();
    toast("Added to history ✓");
  });

  function ingredientChips(dish) {
    const list = dish.ingredients || [];
    if (!list.length) return `<span class="chip chip-empty">No ingredient info</span>`;
    return list.map(i => `<span class="chip">${i}</span>`).join("");
  }

  $("modal-remove").addEventListener("click", () => {
    if (!modalState || !modalState.dish.custom) return;
    if (!confirm(`Remove "${modalState.dish.name}" from the library?`)) return;
    customFoods = customFoods.filter(f => f.id !== modalState.dish.id);
    persistCustomFoods();
    closeModal();
    renderGrid();
    toast("Removed from library");
  });

  $("modal-close").addEventListener("click", closeModal);
  $("modal-backdrop").addEventListener("click", e => {
    if (e.target === $("modal-backdrop")) closeModal();
  });

  /* ---------- scan flow ---------- */
  const scanStages = ["scan-home", "scan-analyzing", "scan-result"];
  function showScanStage(id) {
    scanStages.forEach(s => { $(s).hidden = s !== id; });
  }

  /* ---------- live camera (getUserMedia) ---------- */
  // Opens a real viewfinder for food/barcode scans; the hidden file inputs
  // remain as the fallback (no camera, permission denied, or "Gallery").
  let cameraStream = null;
  let cameraMode = "food";

  function fallbackToFileInput(mode) {
    $(mode === "barcode" ? "barcode-input" : "camera-input").click();
  }

  async function openCamera(mode) {
    cameraMode = mode;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      fallbackToFileInput(mode);
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
    } catch (err) {
      console.warn("Camera unavailable:", err.message);
      toast("Camera unavailable — choose a photo instead");
      fallbackToFileInput(mode);
      return;
    }
    const video = $("camera-video");
    video.srcObject = cameraStream;
    try { await video.play(); } catch { /* autoplay policies — user gesture already given */ }
    $("camera-title").textContent = mode === "barcode" ? "Point at the barcode" : "Point at your food";
    $("camera-overlay").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    $("camera-video").srcObject = null;
    $("camera-overlay").hidden = true;
    document.body.style.overflow = "";
  }

  $("camera-capture").addEventListener("click", () => {
    const video = $("camera-video");
    if (!video.videoWidth) { toast("Camera is still starting…"); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const mode = cameraMode;
    closeCamera();
    if (mode === "barcode") startBarcodeScan(dataUrl);
    else startAnalysis(dataUrl);
  });

  $("camera-close").addEventListener("click", closeCamera);
  $("camera-gallery").addEventListener("click", () => {
    const mode = cameraMode;
    closeCamera();
    fallbackToFileInput(mode);
  });

  $("btn-scan").addEventListener("click", () => openCamera("food"));

  $("camera-input").addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => startAnalysis(reader.result);
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-selecting the same file
  });

  async function startAnalysis(dataUrl) {
    showView("scan");
    showScanStage("scan-analyzing");
    $("analyzing-photo").src = dataUrl;
    $("analyzing-text").textContent = "Analyzing your food…";

    // Wait for the image to load so the model gets valid pixels.
    const img = $("analyzing-photo");
    const usable = await imageReady(img);

    const started = Date.now();
    const result = usable
      ? await Classifier.classify(img, customFoods)
      : { status: "nomatch", rawLabel: "" };
    // Keep the "analyzing" moment perceptible (min ~1.2s) so it doesn't flash.
    const elapsed = Date.now() - started;
    if (elapsed < 1200) await new Promise(r => setTimeout(r, 1200 - elapsed));

    currentScan = { photo: dataUrl, dish: null, confidence: null, portionIdx: 1, prepIdx: null, isPackaged: false, aiResult: result };
    if (result.status === "match") {
      currentScan.dish = result.dish;
      currentScan.confidence = result.confidence;
    }
    renderScanResult();
  }

  function renderScanResult() {
    showScanStage("scan-result");
    $("result-photo").src = currentScan.photo;

    const dish = currentScan.dish;
    if (dish) {
      $("result-detected").hidden = false;
      $("result-unknown").hidden = true;
      $("result-name").textContent = dish.name;
      $("result-category").textContent = dish.category + " Category";
      const conf = currentScan.confidence;
      const badge = $("result-confidence");
      badge.classList.remove("low");
      if (currentScan.isPackaged) {
        badge.textContent = "Barcode ✓";
      } else if (conf != null) {
        const pct = Math.round(conf * 100);
        badge.textContent = pct + "% match";
        badge.classList.toggle("low", pct < 60);
      } else {
        badge.textContent = "Manual pick";
      }
      badge.hidden = false;

      // Ask how it was prepared before revealing the final numbers
      // (skipped for barcode products — the label already tells us).
      if (currentScan.isPackaged) {
        currentScan.prepIdx = 0;
        $("result-prep").hidden = true;
      } else {
        $("result-prep").hidden = false;
        renderPrepChips();
      }
      $("result-nutrition").hidden = currentScan.prepIdx == null;

      renderPortionCards("result-portions", currentScan.portionIdx);
      $("result-ingredients").innerHTML = ingredientChips(dish);
      $("result-details").hidden = true;
      $("result-details-toggle").setAttribute("aria-expanded", "false");
      updateResultNutrition();
    } else {
      // No AI match → prompt manual selection
      $("result-detected").hidden = true;
      $("result-nutrition").hidden = true;
      $("result-prep").hidden = true;
      $("result-unknown").hidden = false;
      const ai = currentScan.aiResult || {};
      $("unknown-message").textContent = ai.status === "unavailable"
        ? "The AI model couldn't load (are you offline?). You can still pick the dish manually."
        : (ai.rawLabel
          ? `I see something like “${ai.rawLabel}”, but it's not in the food library yet.`
          : "Hmm, I couldn't confidently identify this dish.");
    }
  }

  function renderPrepChips() {
    $("result-prep-chips").innerHTML = PREP_METHODS.map((m, i) =>
      `<button type="button" class="prep-chip${i === currentScan.prepIdx ? " active" : ""}" data-idx="${i}">${m.label}</button>`
    ).join("");
  }

  $("result-prep-chips").addEventListener("click", e => {
    const chip = e.target.closest(".prep-chip");
    if (!chip || !currentScan) return;
    currentScan.prepIdx = +chip.dataset.idx;
    renderPrepChips();
    $("result-nutrition").hidden = false;
    updateResultNutrition();
  });

  function updateResultNutrition() {
    if (!currentScan || !currentScan.dish) return;
    const s = scaled(currentScan.dish, currentScan.portionIdx, currentScan.prepIdx || 0);
    $("result-calories").textContent = s.calories;
    $("result-protein").textContent = s.protein + "g";
    $("result-carbs").textContent = s.carbs + "g";
    $("result-fat").textContent = s.fat + "g";
    $("result-portion-desc").textContent = portionDesc(currentScan.portionIdx);
  }

  $("result-portions").addEventListener("click", e => {
    const card = e.target.closest(".portion-card");
    if (!card || !currentScan) return;
    currentScan.portionIdx = +card.dataset.idx;
    renderPortionCards("result-portions", currentScan.portionIdx);
    updateResultNutrition();
  });

  $("result-details-toggle").addEventListener("click", () => {
    const panel = $("result-details");
    const open = panel.hidden;
    panel.hidden = !open;
    $("result-details-toggle").setAttribute("aria-expanded", String(open));
  });

  $("btn-wrong").addEventListener("click", enterPickerMode);
  $("btn-pick-manual").addEventListener("click", enterPickerMode);
  $("btn-rescan").addEventListener("click", () => {
    currentScan = null;
    showScanStage("scan-home");
    openCamera("food");
  });

  $("btn-save").addEventListener("click", async () => {
    if (!currentScan || !currentScan.dish) return;
    const thumb = await downscale(currentScan.photo, 300);
    const s = scaled(currentScan.dish, currentScan.portionIdx, currentScan.prepIdx || 0);
    saveHistoryEntry({
      dishId: currentScan.dish.id,
      name: currentScan.dish.name,
      category: currentScan.dish.category,
      portionIdx: currentScan.portionIdx,
      prepIdx: currentScan.prepIdx || 0,
      calories: s.calories,
      protein: s.protein, carbs: s.carbs, fat: s.fat,
      confidence: currentScan.confidence,
      photo: thumb,
      time: Date.now(),
    });
    toast("Saved to history ✓");
    currentScan = null;
    showScanStage("scan-home");
    showView("history");
  });

  /* ---------- barcode scanning ---------- */
  $("btn-barcode").addEventListener("click", () => openCamera("barcode"));

  $("barcode-input").addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => startBarcodeScan(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  });

  async function startBarcodeScan(dataUrl) {
    showView("scan");
    showScanStage("scan-analyzing");
    $("analyzing-photo").src = dataUrl;
    $("analyzing-text").textContent = "Reading barcode…";
    const img = $("analyzing-photo");
    const usable = await imageReady(img);

    const code = usable ? await Barcode.decode(img) : null;
    if (!code) {
      toast("No barcode found — hold it flat and well-lit");
      showScanStage("scan-home");
      return;
    }

    $("analyzing-text").textContent = `Barcode ${code} — looking up product…`;
    let product = null;
    try { product = await Barcode.lookupProduct(code); }
    catch (err) { console.warn("Product lookup failed:", err.message); }

    currentScan = { photo: dataUrl, dish: null, confidence: null, portionIdx: 1, prepIdx: 0, isPackaged: true, aiResult: null };
    if (product) {
      currentScan.dish = {
        id: "barcode-" + product.code,
        name: product.brand ? `${product.name} (${product.brand})` : product.name,
        category: "Others",
        calories: product.calories, protein: product.protein, carbs: product.carbs, fat: product.fat,
        servingDesc: product.servingDesc,
        ingredients: product.ingredients,
        keywords: [], img: null,
      };
      renderScanResult();
    } else {
      currentScan.isPackaged = false;
      currentScan.aiResult = { status: "nomatch", rawLabel: "" };
      renderScanResult();
      $("unknown-message").textContent =
        `Barcode ${code} was read, but the product isn't in the database yet. You can add it as a new food.`;
    }
  }

  // Downscale a photo dataURL to keep localStorage small.
  function downscale(dataUrl, maxSize) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  /* ---------- history ---------- */
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
  }

  function persistHistory(list) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch {
      // Quota exceeded — drop oldest photos and retry once.
      list.slice(10).forEach(e => { e.photo = null; });
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch { /* give up quietly */ }
    }
  }

  function saveHistoryEntry(entry) {
    const list = loadHistory();
    list.unshift(entry);
    persistHistory(list.slice(0, 50)); // keep the 50 most recent
    renderDashboard();
  }

  /* ---------- daily summary dashboard ---------- */
  const GOAL_KEY = "caloriesnap_goal";
  const MACRO_TARGETS = { protein: 75, carbs: 250, fat: 70 };

  function getGoal() { return +localStorage.getItem(GOAL_KEY) || 2000; }

  function todayTotals() {
    const today = new Date().toDateString();
    return loadHistory()
      .filter(e => new Date(e.time).toDateString() === today)
      .reduce((t, e) => ({
        calories: t.calories + (e.calories || 0),
        protein: t.protein + (e.protein || 0),
        carbs: t.carbs + (e.carbs || 0),
        fat: t.fat + (e.fat || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }

  function renderDashboard() {
    const goal = getGoal();
    const t = todayTotals();
    const pct = Math.min(1, t.calories / goal);
    const color = t.calories >= goal ? "var(--danger)" : pct >= 0.85 ? "var(--carbs)" : "var(--green)";
    const C = +(2 * Math.PI * 42).toFixed(1);
    const bar = (key, label, val, target) => `
      <div class="dash-macro">
        <span class="dash-macro-label ${key}">${label}</span>
        <div class="dash-macro-bar"><div class="dash-macro-fill ${key}" style="width:${Math.min(100, val / target * 100)}%"></div></div>
        <span class="dash-macro-val">${Math.round(val)} / ${target}g</span>
      </div>`;
    const html = `<div class="dash-card">
      <svg class="dash-ring" viewBox="0 0 100 100" role="img" aria-label="${t.calories} of ${goal} calories consumed today">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line)" stroke-width="10"/>
        <circle cx="50" cy="50" r="42" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
          stroke-dasharray="${C}" stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}" transform="rotate(-90 50 50)"/>
        <text x="50" y="48" class="ring-num">${t.calories}</text>
        <text x="50" y="63" class="ring-sub">/ ${goal} kcal</text>
      </svg>
      <div class="dash-info">
        <div class="dash-title">Today's summary <button type="button" class="dash-goal-btn">✎ Goal</button></div>
        ${bar("p", "P", t.protein, MACRO_TARGETS.protein)}
        ${bar("c", "C", t.carbs, MACRO_TARGETS.carbs)}
        ${bar("f", "F", t.fat, MACRO_TARGETS.fat)}
      </div>
    </div>`;
    $("dash-scan").innerHTML = html;
    $("dash-history").innerHTML = html;
  }

  document.addEventListener("click", e => {
    if (!e.target.closest(".dash-goal-btn")) return;
    const input = prompt("Set your daily calorie goal:", getGoal());
    const goal = parseInt(input, 10);
    if (goal > 0) {
      localStorage.setItem(GOAL_KEY, goal);
      renderDashboard();
      toast(`Daily goal set to ${goal} kcal`);
    }
  });

  function fmtTime(ts) {
    const d = new Date(ts);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return sameDay ? "Today, " + time : d.toLocaleDateString([], { day: "numeric", month: "short" }) + ", " + time;
  }

  function renderHistory() {
    const list = loadHistory();
    const container = $("history-list");
    $("history-empty").hidden = list.length > 0;

    container.innerHTML = list.map((e, i) => {
      const dish = findFood(e.dishId);
      const thumb = e.photo
        ? `<img src="${e.photo}" alt="${e.name}">`
        : (dish ? foodImg(dish, e.name) : `<img src="${PLACEHOLDER_IMG}" alt="">`);
      const conf = e.confidence != null ? ` · ${Math.round(e.confidence * 100)}% match` : "";
      const prep = e.prepIdx > 0 ? ` · ${PREP_METHODS[e.prepIdx].label}` : "";
      return `<div class="history-item">
        <div class="history-thumb">${thumb}</div>
        <div class="history-info">
          <div class="history-name">${e.name}</div>
          <div class="history-meta">${e.category} · ${PORTIONS[e.portionIdx].key} portion${prep}${conf}<br>${fmtTime(e.time)}</div>
        </div>
        <div class="history-cal">${e.calories} kcal</div>
        <button class="history-delete" data-index="${i}" aria-label="Delete entry">🗑</button>
      </div>`;
    }).join("");
  }

  $("history-list").addEventListener("click", e => {
    const btn = e.target.closest(".history-delete");
    if (!btn) return;
    const list = loadHistory();
    list.splice(+btn.dataset.index, 1);
    persistHistory(list);
    renderHistory();
    renderDashboard();
  });

  $("btn-clear-history").addEventListener("click", () => {
    if (loadHistory().length === 0) return;
    if (confirm("Clear all history?")) {
      persistHistory([]);
      renderHistory();
      renderDashboard();
    }
  });

  /* ---------- add new food (grow the library from scans) ---------- */
  function openAddFood() {
    if (!currentScan) { toast("Scan a food photo first"); return; }
    const sel = $("af-category");
    if (!sel.options.length) {
      sel.innerHTML = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
    }
    $("addfood-photo").innerHTML = `<img src="${currentScan.photo}" alt="Your food photo">`;
    $("addfood-form").reset();
    $("af-error").hidden = true;
    $("af-lookup-status").hidden = true;
    clearTimeout(lookupTimer);
    lastLookedUp = "";
    $("addfood-backdrop").hidden = false;
    document.body.style.overflow = "hidden";
  }

  // Look up nutrition online (USDA → Open Food Facts) and populate the form.
  // Runs automatically ~1s after the user stops typing the name (fills only
  // empty fields); the button re-runs it manually and overwrites.
  let lookupTimer = null;
  let lastLookedUp = "";

  async function runLookup(auto) {
    const name = $("af-name").value.trim();
    const status = $("af-lookup-status");
    const btn = $("af-lookup");
    if (auto && name.toLowerCase() === lastLookedUp) return;
    if (name.length < 3) {
      if (!auto) {
        status.hidden = false;
        status.classList.add("error");
        status.textContent = "Type the food name first, then tap Look up.";
      }
      return;
    }
    lastLookedUp = name.toLowerCase();
    btn.disabled = true;
    btn.textContent = "Searching…";
    status.hidden = false;
    status.classList.remove("error");
    status.textContent = `Searching online for “${name}”…`;
    try {
      const hit = await Nutrition.lookup(name);
      if (hit) {
        const fill = (id, val) => {
          if (val && (!auto || !$(id).value.trim())) $(id).value = val;
        };
        fill("af-calories", hit.calories);
        fill("af-protein", hit.protein);
        fill("af-carbs", hit.carbs);
        fill("af-fat", hit.fat);
        if (hit.ingredients.length && !$("af-ingredients").value.trim()) {
          $("af-ingredients").value = hit.ingredients.join(", ");
        }
        status.textContent = `✓ Found “${hit.name}” (${hit.source}). ${hit.servingNote}. Adjust anything that looks off.`;
      } else {
        status.classList.add("error");
        status.textContent = `Couldn't find “${name}” online — please enter the values manually.`;
      }
    } catch {
      status.classList.add("error");
      status.textContent = "Nutrition services are busy or you're offline — try again shortly, or enter the values manually.";
      lastLookedUp = ""; // transient failure — allow the auto-lookup to retry
    }
    btn.disabled = false;
    btn.textContent = "🔍 Look up nutrition";
  }

  $("af-lookup").addEventListener("click", () => {
    lastLookedUp = ""; // manual tap always re-searches
    runLookup(false);
  });

  // Auto-lookup shortly after the user finishes typing the food name.
  $("af-name").addEventListener("input", () => {
    clearTimeout(lookupTimer);
    if ($("af-name").value.trim().length < 4) return;
    lookupTimer = setTimeout(() => runLookup(true), 900);
  });

  function closeAddFood() {
    clearTimeout(lookupTimer);
    $("addfood-backdrop").hidden = true;
    document.body.style.overflow = "";
  }

  $("btn-add-new").addEventListener("click", openAddFood);
  $("btn-add-new-2").addEventListener("click", openAddFood);
  $("addfood-close").addEventListener("click", closeAddFood);
  $("addfood-backdrop").addEventListener("click", e => {
    if (e.target === $("addfood-backdrop")) closeAddFood();
  });

  $("addfood-form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("af-name").value.trim();
    const category = $("af-category").value;
    const calories = +$("af-calories").value;
    const err = $("af-error");
    if (!name || !category || !(calories > 0)) {
      err.textContent = "Please fill in the food name, category and calories.";
      err.hidden = false;
      return;
    }
    if (allFoods().some(f => f.name.toLowerCase() === name.toLowerCase())) {
      err.textContent = `"${name}" is already in the library — pick it from the ${category} tab instead.`;
      err.hidden = false;
      return;
    }
    const photo = await downscale(currentScan.photo, 400);
    const dish = {
      id: "custom-" + Date.now(),
      name, category, calories,
      protein: +$("af-protein").value || 0,
      carbs: +$("af-carbs").value || 0,
      fat: +$("af-fat").value || 0,
      servingDesc: "",
      ingredients: $("af-ingredients").value.split(",").map(s => s.trim()).filter(Boolean),
      keywords: [name.toLowerCase()],
      img: photo,
      custom: true,
    };
    // Fingerprint the photo so future scans of this dish are recognised.
    try {
      const embedImg = new Image();
      embedImg.src = currentScan.photo;
      if (await imageReady(embedImg)) {
        dish.embedding = await Classifier.embed(embedImg);
      }
    } catch (err) {
      console.warn("Couldn't fingerprint photo (offline?):", err.message);
    }

    customFoods.push(dish);
    persistCustomFoods();
    renderGrid();
    closeAddFood();
    exitPickerMode();
    currentScan.dish = dish;
    currentScan.confidence = null;
    currentScan.portionIdx = 1;
    currentScan.prepIdx = 0; // user already entered calories as prepared
    showView("scan");
    renderScanResult();
    toast(`Added "${name}" to ${category} ✓`);
  });

  /* ---------- logo → back to home ---------- */
  $("logo-home").addEventListener("click", () => {
    closeModal();
    closeAddFood();
    closeCamera();
    exitPickerMode();
    currentScan = null;
    showScanStage("scan-home");
    showView("scan");
  });

  /* ---------- init ---------- */
  renderTabs();
  renderGrid();
  renderHistory();
  renderDashboard();

  // Warm up the AI model in the background if we're online.
  if (navigator.onLine) {
    $("model-status").textContent = "Loading AI model in the background…";
    Classifier.ensureModel()
      .then(() => { $("model-status").textContent = "✓ AI ready"; })
      .catch(() => { $("model-status").textContent = "AI offline — manual pick still works"; });
  } else {
    $("model-status").textContent = "Offline — AI unavailable, manual pick still works";
  }
})();
