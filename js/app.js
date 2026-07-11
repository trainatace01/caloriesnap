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

  /* ---------- per-food value corrections (persist to the food) ----------
     Custom foods are edited in place; built-in dishes get a stored override
     keyed by id (base / ×1.0 values), applied via effectiveDish(). */
  const FOOD_OVERRIDE_KEY = "caloriesnap_food_overrides";
  let foodOverrides = (() => {
    try { return JSON.parse(localStorage.getItem(FOOD_OVERRIDE_KEY)) || {}; }
    catch { return {}; }
  })();
  function persistFoodOverrides() {
    try { localStorage.setItem(FOOD_OVERRIDE_KEY, JSON.stringify(foodOverrides)); } catch { /* quota */ }
  }
  function effectiveDish(dish) {
    const o = dish && !dish.custom && foodOverrides[dish.id];
    return o ? { ...dish, calories: o.calories, protein: o.protein, carbs: o.carbs, fat: o.fat } : dish;
  }
  // base = { calories, protein, carbs, fat } at ×1.0 (medium, as-served)
  function setFoodValues(dish, base) {
    if (dish.custom) {
      dish.calories = base.calories; dish.protein = base.protein;
      dish.carbs = base.carbs; dish.fat = base.fat;
      persistCustomFoods();
    } else {
      foodOverrides[dish.id] = base;
      persistFoodOverrides();
    }
  }

  const escAttr = s => String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;");

  /* ---------- cuisine tags (core + user-added, extendable) ---------- */
  const CUISINE_KEY = "caloriesnap_custom_cuisines";
  const LAST_CUISINE_KEY = "caloriesnap_last_cuisine";
  let customCuisines = (() => {
    try { const s = JSON.parse(localStorage.getItem(CUISINE_KEY)); return Array.isArray(s) ? s : []; }
    catch { return []; }
  })();
  function persistCustomCuisines() { try { localStorage.setItem(CUISINE_KEY, JSON.stringify(customCuisines)); } catch { /* quota */ } }
  function allCuisines() { return CATEGORIES.concat(customCuisines); }
  function isCoreCuisine(name) { return CATEGORIES.includes(name); }
  function addCuisine(name) {
    name = name.trim();
    if (!name) return false;
    if (allCuisines().some(c => c.toLowerCase() === name.toLowerCase())) return false;
    customCuisines.push(name); persistCustomCuisines(); return true;
  }
  function renameCuisine(oldName, newName) {
    newName = newName.trim();
    const i = customCuisines.indexOf(oldName);
    if (i < 0 || !newName || allCuisines().some(c => c.toLowerCase() === newName.toLowerCase())) return;
    customCuisines[i] = newName; persistCustomCuisines();
  }
  function deleteCuisine(name) { customCuisines = customCuisines.filter(c => c !== name); persistCustomCuisines(); }
  function getLastCuisine() { return localStorage.getItem(LAST_CUISINE_KEY) || "Others"; }
  function setLastCuisine(name) { localStorage.setItem(LAST_CUISINE_KEY, name); }

  /* ---------- meal type (fixed, mandatory) ---------- */
  const LAST_MEAL_KEY = "caloriesnap_last_meal";
  function getLastMeal() { return localStorage.getItem(LAST_MEAL_KEY) || MEAL_TYPES[0]; }
  function setLastMeal(name) { localStorage.setItem(LAST_MEAL_KEY, name); }

  /* ---------- reusable pill picker (cuisine + meal type) ---------- */
  function renderPills(containerId, opts) {
    const chips = opts.items.map(c =>
      `<button type="button" class="meal-chip${c === opts.selected ? " active" : ""}" data-val="${escAttr(c)}">${escAttr(c)}</button>`
    ).join("");
    const newBtn = opts.allowNew ? `<button type="button" class="meal-chip meal-chip-new" data-new="1">＋ New</button>` : "";
    $(containerId).innerHTML = `<div class="meal-picker-label">${opts.label}</div><div class="meal-chips">${chips}${newBtn}</div>`;
  }
  function renderPillNewInput(containerId, label, placeholder) {
    $(containerId).innerHTML =
      `<div class="meal-picker-label">${label}</div>
       <div class="meal-new-row">
         <input class="meal-new-input" type="text" maxlength="30" placeholder="${placeholder}" autocomplete="off">
         <button type="button" class="meal-new-save">Add</button>
         <button type="button" class="meal-new-cancel">Cancel</button>
       </div>`;
    const inp = $(containerId).querySelector(".meal-new-input");
    if (inp) inp.focus();
  }
  // cfg: { label, getItems, getSelected, setSelected, allowNew?, onNew?, newLabel?, newPlaceholder? }
  function setupPicker(containerId, cfg) {
    const el = $(containerId);
    const rerender = () => renderPills(containerId, { label: cfg.label, items: cfg.getItems(), selected: cfg.getSelected(), allowNew: cfg.allowNew });
    const commitNew = () => {
      const name = el.querySelector(".meal-new-input").value.trim();
      if (name && cfg.onNew && cfg.onNew(name)) cfg.setSelected(name);
      rerender();
    };
    el.addEventListener("click", e => {
      if (cfg.allowNew && e.target.closest(".meal-chip-new")) return renderPillNewInput(containerId, cfg.newLabel, cfg.newPlaceholder);
      const chip = e.target.closest(".meal-chip[data-val]");
      if (chip) { cfg.setSelected(chip.dataset.val); return rerender(); }
      if (e.target.closest(".meal-new-save")) return commitNew();
      if (e.target.closest(".meal-new-cancel")) return rerender();
    });
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target.classList.contains("meal-new-input")) { e.preventDefault(); commitNew(); }
    });
    return rerender;
  }

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
  let currentScan = null;          // { photo, dish, confidence, portionIdx, cuisine, mealType, edited, override }
  let modalState = null;           // { dish, portionIdx, cuisine, mealType }
  let afCuisine = "Others";        // selected cuisine in the Add-Food form
  let reviewIndex = null;          // history index open in the Meal Review sheet

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
    if (name === "stats") renderStats();
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
    const tabs = ["All", ...allCuisines()];
    $("category-tabs").innerHTML = tabs.map(c =>
      `<button class="tab${c === activeCategory ? " active" : ""}" role="tab" data-cat="${c}">${c}</button>`
    ).join("");
    const active = $("category-tabs").querySelector(".tab.active");
    if (active) active.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }

  function stepCategory(dir) {
    const tabs = ["All", ...allCuisines()];
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
    $("food-grid").innerHTML = foods.map(f => {
      const cal = effectiveDish(f).calories;
      return `<button class="food-card" data-id="${f.id}" aria-label="${f.name}, ${cal} calories">
        <div class="food-card-img">${foodImg(f)}</div>
        <div class="food-card-body">
          <div class="food-card-name">${f.name}</div>
          <div class="food-card-cal">${cal} kcal</div>
        </div>
      </button>`;
    }).join("");
    $("no-results").hidden = foods.length > 0;
    $("btn-library-add").textContent = activeCategory === "All"
      ? "＋ Add Food" : `＋ Add Food to ${activeCategory}`;
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
      currentScan.isPackaged = false; // picked a library dish — not a barcode product
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
    modalState.cuisine = dish.category;
    modalState.mealType = getLastMeal();
    renderPills("modal-cuisine-picker", { label: "Cuisine", items: allCuisines(), selected: modalState.cuisine, allowNew: true });
    renderPills("modal-meal-picker", { label: "Meal type", items: MEAL_TYPES, selected: modalState.mealType });
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
    const s = scaled(effectiveDish(modalState.dish), modalState.portionIdx);
    $("modal-calories").value = s.calories;
    $("modal-protein").value = s.protein;
    $("modal-carbs").value = s.carbs;
    $("modal-fat").value = s.fat;
    $("modal-portion-desc").textContent = portionDesc(modalState.portionIdx);
  }

  // Tap-to-edit in the detail modal → save the correction to the food itself.
  // Inputs show values at the current portion; divide out the multiplier to
  // store the standard (×1.0) base.
  function onModalEdit() {
    if (!modalState) return;
    const m = PORTIONS[modalState.portionIdx].mult || 1;
    setFoodValues(modalState.dish, {
      calories: Math.max(0, Math.round((+$("modal-calories").value || 0) / m)),
      protein: Math.max(0, Math.round((+$("modal-protein").value || 0) / m)),
      carbs: Math.max(0, Math.round((+$("modal-carbs").value || 0) / m)),
      fat: Math.max(0, Math.round((+$("modal-fat").value || 0) / m)),
    });
    renderGrid();
  }
  ["modal-calories", "modal-protein", "modal-carbs", "modal-fat"].forEach(id =>
    $(id).addEventListener("input", onModalEdit));

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
    const s = scaled(effectiveDish(modalState.dish), modalState.portionIdx);
    saveHistoryEntry({
      dishId: modalState.dish.id,
      name: modalState.dish.name,
      category: modalState.cuisine || modalState.dish.category,
      mealCategory: modalState.mealType || getLastMeal(),
      portionIdx: modalState.portionIdx,
      prepIdx: 0,
      calories: s.calories,
      protein: s.protein, carbs: s.carbs, fat: s.fat,
      photo: null, // library entry — thumbnail uses the dish photo
      time: Date.now(),
    });
    setLastMeal(modalState.mealType || getLastMeal());
    closeModal();
    toast("Logged ✓");
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
      // Name: editable only for transient barcode products (safe to rename —
      // not a shared library record). Library/custom dishes stay read-only.
      const nameEditable = !!currentScan.isPackaged && !dish.custom;
      const nameEl = $("result-name");
      nameEl.value = dish.name;
      nameEl.readOnly = !nameEditable;
      nameEl.classList.toggle("editable", nameEditable);
      $("result-name-hint").hidden = !nameEditable;
      $("btn-save-library").hidden = !nameEditable;
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
      currentScan.edited = false; currentScan.override = null;
      if (!currentScan.cuisine) currentScan.cuisine = dish.category || getLastCuisine();
      if (!currentScan.mealType) currentScan.mealType = getLastMeal();
      renderPills("result-cuisine-picker", { label: "Cuisine", items: allCuisines(), selected: currentScan.cuisine, allowNew: true });
      renderPills("result-meal-picker", { label: "Meal type", items: MEAL_TYPES, selected: currentScan.mealType });
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

  // Clearing a manual edit when portion/prep changes (so the numbers recompute).
  function clearOverride() {
    if (currentScan && currentScan.edited) {
      currentScan.edited = false;
      currentScan.override = null;
      toast("Recalculated from portion & prep");
    }
  }

  $("result-prep-chips").addEventListener("click", e => {
    const chip = e.target.closest(".prep-chip");
    if (!chip || !currentScan) return;
    clearOverride();
    currentScan.prepIdx = +chip.dataset.idx;
    renderPrepChips();
    $("result-nutrition").hidden = false;
    updateResultNutrition();
  });

  function resultNutrition() {
    return currentScan.edited && currentScan.override
      ? currentScan.override
      : scaled(currentScan.dish, currentScan.portionIdx, currentScan.prepIdx || 0);
  }

  function updateResultNutrition() {
    if (!currentScan || !currentScan.dish) return;
    if (!currentScan.edited) {
      const s = scaled(currentScan.dish, currentScan.portionIdx, currentScan.prepIdx || 0);
      $("result-calories").value = s.calories;
      $("result-protein").value = s.protein;
      $("result-carbs").value = s.carbs;
      $("result-fat").value = s.fat;
    }
    $("result-portion-desc").textContent = currentScan.edited
      ? "✎ Edited values" : portionDesc(currentScan.portionIdx);
  }

  // Tap-to-edit any number → per-log override (never changes the saved food).
  $("result-nutrition").addEventListener("input", e => {
    if (!currentScan || !e.target.matches(".cal-input, .macro-input")) return;
    currentScan.edited = true;
    currentScan.override = {
      calories: Math.max(0, +$("result-calories").value || 0),
      protein: Math.max(0, +$("result-protein").value || 0),
      carbs: Math.max(0, +$("result-carbs").value || 0),
      fat: Math.max(0, +$("result-fat").value || 0),
    };
    $("result-portion-desc").textContent = "✎ Edited values";
  });

  $("result-portions").addEventListener("click", e => {
    const card = e.target.closest(".portion-card");
    if (!card || !currentScan) return;
    clearOverride();
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

  // Rename a barcode product (transient dish — safe to mutate directly).
  $("result-name").addEventListener("input", () => {
    if (!currentScan || !currentScan.dish || $("result-name").readOnly) return;
    currentScan.dish.name = $("result-name").value.trim() || currentScan.dish.name;
  });

  // Save a barcode product into the library for future scans.
  $("btn-save-library").addEventListener("click", async () => {
    if (!currentScan || !currentScan.dish || !currentScan.isPackaged) return;
    const dish = currentScan.dish;
    const code = dish.barcode || (dish.id.startsWith("barcode-") ? dish.id.slice(8) : null);

    // Duplicate guard — already saved from an earlier scan of this barcode.
    const existing = code && customFoods.find(f => f.barcode === code);
    if (existing) {
      currentScan.dish = existing;
      $("btn-save-library").hidden = true;
      toast("Already in your library");
      return;
    }

    const name = ($("result-name").value.trim() || dish.name).slice(0, 60);
    const s = resultNutrition(); // current serving numbers incl. any tap-edits
    const m = PORTIONS[currentScan.portionIdx].mult || 1; // store ×1.0 base
    const photo = await downscale(currentScan.photo, 400);
    const saved = {
      id: "custom-" + Date.now(),
      name,
      category: currentScan.cuisine || dish.category || "Others",
      calories: Math.round(s.calories / m), protein: Math.round(s.protein / m),
      carbs: Math.round(s.carbs / m), fat: Math.round(s.fat / m),
      servingDesc: dish.servingDesc || "",
      ingredients: dish.ingredients || [],
      keywords: [name.toLowerCase()],
      img: photo,
      barcode: code,
      custom: true,
    };
    customFoods.push(saved);
    persistCustomFoods();
    renderGrid();
    currentScan.dish = saved; // Log Meal now references the saved food
    currentScan.edited = false; currentScan.override = null;
    updateResultNutrition(); // re-sync display from the saved base × portion
    $("btn-save-library").hidden = true;
    $("result-name").readOnly = true;
    $("result-name").classList.remove("editable");
    $("result-name-hint").hidden = true;
    toast(`Saved "${name}" to library ✓`);
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
    const s = resultNutrition();
    const cuisine = currentScan.cuisine || currentScan.dish.category;
    const mealType = currentScan.mealType || getLastMeal();
    saveHistoryEntry({
      dishId: currentScan.dish.id,
      name: currentScan.dish.name,
      category: cuisine,
      mealCategory: mealType,
      portionIdx: currentScan.portionIdx,
      prepIdx: currentScan.prepIdx || 0,
      edited: !!currentScan.edited,
      calories: s.calories,
      protein: s.protein, carbs: s.carbs, fat: s.fat,
      confidence: currentScan.confidence,
      photo: thumb,
      time: Date.now(),
    });
    setLastMeal(mealType); setLastCuisine(cuisine);
    toast("Logged ✓");
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

    // Scanned this product before and saved it? Use the saved food directly —
    // keeps the user's corrected name/values and works offline.
    const savedFood = customFoods.find(f => f.barcode === code);
    if (savedFood) {
      currentScan = { photo: dataUrl, dish: savedFood, confidence: null, portionIdx: 1, prepIdx: 0, isPackaged: true, aiResult: null };
      renderScanResult();
      $("result-confidence").textContent = "Barcode ✓ saved";
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
        barcode: product.code,
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

  // Fetch a web image (Wikipedia/OFF — CORS-enabled hosts) and store it as a
  // small local dataURL so the library keeps working offline. Fetch→blob→
  // object URL avoids canvas tainting. Returns null on any failure.
  async function webImageToDataUrl(url) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const dataUrl = await downscale(objUrl, 400);
      URL.revokeObjectURL(objUrl);
      return dataUrl;
    } catch {
      return null;
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

  // Totals + entries for any time window [fromTs, toTs).
  function rangeTotals(fromTs, toTs) {
    const entries = loadHistory().filter(e => e.time >= fromTs && e.time < toTs);
    const totals = entries.reduce((t, e) => ({
      calories: t.calories + (e.calories || 0),
      protein: t.protein + (e.protein || 0),
      carbs: t.carbs + (e.carbs || 0),
      fat: t.fat + (e.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    return { ...totals, entries };
  }

  function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

  function todayTotals() {
    return rangeTotals(startOfToday().getTime(), Date.now() + 1);
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
        <div class="dash-title">Calories Consumed Today <button type="button" class="dash-goal-btn">✎ Goal</button></div>
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
      return `<div class="history-item" data-index="${i}" role="button" tabindex="0">
        <div class="history-thumb">${thumb}</div>
        <div class="history-info">
          <div class="history-name">${e.name}</div>
          <div class="hist-tags"><span class="hist-mealcat">${e.mealCategory || "Uncategorized"}</span><span class="hist-cuisine">${e.category || "—"}</span></div>
          <div class="history-meta">${PORTIONS[e.portionIdx].key} portion${prep}${conf} · ${fmtTime(e.time)}</div>
        </div>
        <div class="history-cal">${e.calories} kcal</div>
        <button class="history-delete" data-index="${i}" aria-label="Delete entry">🗑</button>
      </div>`;
    }).join("");
  }

  $("history-list").addEventListener("click", e => {
    const del = e.target.closest(".history-delete");
    if (del) {
      const list = loadHistory();
      list.splice(+del.dataset.index, 1);
      persistHistory(list);
      renderHistory();
      renderDashboard();
      return;
    }
    const item = e.target.closest(".history-item");
    if (item) openReview(+item.dataset.index);
  });

  /* ---------- Meal Review drill-down sheet ---------- */
  function openReview(index) {
    const e = loadHistory()[index];
    if (!e) return;
    reviewIndex = index;
    const dish = findFood(e.dishId);
    $("review-image").innerHTML = e.photo
      ? `<img src="${e.photo}" alt="${escAttr(e.name)}">`
      : (dish ? foodImg(dish, e.name) : `<img src="${PLACEHOLDER_IMG}" alt="">`);
    $("review-name").textContent = e.name;
    $("review-cuisine").textContent = e.category || "—";
    $("review-mealtype").textContent = e.mealCategory || "Uncategorized";
    const prep = e.prepIdx > 0 && PREP_METHODS[e.prepIdx] ? PREP_METHODS[e.prepIdx].label : "As served";
    $("review-context").textContent = `${PORTIONS[e.portionIdx] ? PORTIONS[e.portionIdx].name : "Medium"} portion · ${prep}${e.edited ? " · ✎ edited" : ""}`;
    $("review-time").textContent = fmtTime(e.time);
    $("review-calories").value = e.calories;
    $("review-protein").value = e.protein || 0;
    $("review-carbs").value = e.carbs || 0;
    $("review-fat").value = e.fat || 0;
    $("review-backdrop").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeReview() {
    $("review-backdrop").hidden = true;
    document.body.style.overflow = "";
    reviewIndex = null;
    renderHistory();
  }

  // Tap-to-edit a logged entry → overwrite that history entry's numbers.
  function onReviewEdit() {
    if (reviewIndex == null) return;
    const list = loadHistory();
    const e = list[reviewIndex];
    if (!e) return;
    e.calories = Math.max(0, +$("review-calories").value || 0);
    e.protein = Math.max(0, +$("review-protein").value || 0);
    e.carbs = Math.max(0, +$("review-carbs").value || 0);
    e.fat = Math.max(0, +$("review-fat").value || 0);
    e.edited = true;
    persistHistory(list);
    renderDashboard();
  }
  ["review-calories", "review-protein", "review-carbs", "review-fat"].forEach(id =>
    $(id).addEventListener("input", onReviewEdit));
  $("review-close").addEventListener("click", closeReview);
  $("review-backdrop").addEventListener("click", e => { if (e.target === $("review-backdrop")) closeReview(); });
  $("review-delete").addEventListener("click", () => {
    if (reviewIndex == null) return;
    const list = loadHistory();
    list.splice(reviewIndex, 1);
    persistHistory(list);
    closeReview();
    renderHistory();
    renderDashboard();
    toast("Entry deleted");
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
  // source: "scan" (from a scan photo, today's flow) or "library"
  // (＋ Add Food in Browse Menu — no photo; image is fetched from the web).
  let afSource = "scan";
  let afWebPhoto = null;

  function openAddFood(source = "scan") {
    afSource = source;
    afWebPhoto = null;
    if (source === "scan") {
      if (!currentScan) { toast("Scan a food photo first"); return; }
      $("addfood-photo").innerHTML = `<img src="${currentScan.photo}" alt="Your food photo">`;
      afCuisine = currentScan.cuisine || getLastCuisine();
    } else {
      $("addfood-photo").innerHTML =
        `<div class="addfood-placeholder">🍽️<span>Type the food's name — we'll search online for its photo and nutrition</span></div>`;
      afCuisine = (activeCategory !== "All" && activeCategory) || getLastCuisine();
    }
    $("addfood-form").reset();
    renderPills("af-cuisine-pills", { label: "Cuisine *", items: allCuisines(), selected: afCuisine, allowNew: true });
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
        // Library mode: also fetch the food's photo from the web (non-blocking).
        if (afSource === "library" && hit.image && !afWebPhoto) {
          webImageToDataUrl(hit.image).then(dataUrl => {
            if (dataUrl && afSource === "library" && !$("addfood-backdrop").hidden) {
              afWebPhoto = dataUrl;
              $("addfood-photo").innerHTML = `<img src="${dataUrl}" alt="Food photo from the web">`;
            }
          });
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

  $("btn-add-new").addEventListener("click", () => openAddFood("scan"));
  $("btn-add-new-2").addEventListener("click", () => openAddFood("scan"));
  $("btn-library-add").addEventListener("click", () => openAddFood("library"));
  $("addfood-close").addEventListener("click", closeAddFood);
  $("af-cancel").addEventListener("click", closeAddFood);
  $("addfood-backdrop").addEventListener("click", e => {
    if (e.target === $("addfood-backdrop")) closeAddFood();
  });

  $("addfood-form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("af-name").value.trim();
    const category = afCuisine;
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
    const fromScan = afSource === "scan" && currentScan;
    const photo = fromScan ? await downscale(currentScan.photo, 400) : afWebPhoto;
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
    // Fingerprint the scan photo so future scans of this dish are recognised
    // (library adds have a web/stock photo — not useful as a fingerprint).
    if (fromScan) {
      try {
        const embedImg = new Image();
        embedImg.src = currentScan.photo;
        if (await imageReady(embedImg)) {
          dish.embedding = await Classifier.embed(embedImg);
        }
      } catch (err) {
        console.warn("Couldn't fingerprint photo (offline?):", err.message);
      }
    }

    customFoods.push(dish);
    persistCustomFoods();
    renderGrid();
    closeAddFood();

    if (fromScan) {
      exitPickerMode();
      currentScan.dish = dish;
      currentScan.confidence = null;
      currentScan.portionIdx = 1;
      currentScan.prepIdx = 0; // user already entered calories as prepared
      showView("scan");
      renderScanResult();
    } else {
      // Added from Browse Menu — jump to the food's category so it's visible.
      activeCategory = category;
      renderTabs();
      renderGrid();
      showView("library");
    }
    toast(`Added "${name}" to ${category} ✓`);
  });

  /* ---------- Stats tab (time views + analytics) ---------- */
  let statsRange = "today";
  let statsMealFilter = "All";

  function sumEntries(entries) {
    return entries.reduce((t, e) => ({
      calories: t.calories + (e.calories || 0), protein: t.protein + (e.protein || 0),
      carbs: t.carbs + (e.carbs || 0), fat: t.fat + (e.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }

  function rangeBounds(key) {
    const startToday = startOfToday();
    if (key === "yesterday") {
      const y = new Date(startToday); y.setDate(y.getDate() - 1);
      return { from: y.getTime(), to: startToday.getTime(), days: 1, label: "yesterday" };
    }
    if (key === "week") {
      const d = new Date(startToday);
      const dow = (d.getDay() + 6) % 7; // Monday = 0
      d.setDate(d.getDate() - dow);
      return { from: d.getTime(), to: Date.now() + 1, days: dow + 1, label: "this week" };
    }
    if (key === "month") {
      const m = new Date(startToday.getFullYear(), startToday.getMonth(), 1);
      return { from: m.getTime(), to: Date.now() + 1, days: new Date().getDate(), label: "this month" };
    }
    return { from: startToday.getTime(), to: Date.now() + 1, days: 1, label: "today" };
  }

  function renderStats() {
    const b = rangeBounds(statsRange);
    const range = rangeTotals(b.from, b.to);
    const mf = statsMealFilter;
    const filterMeal = arr => mf === "All" ? arr : arr.filter(e => (e.mealCategory || "") === mf);

    const rangeEntries = filterMeal(range.entries);
    const t = sumEntries(rangeEntries);
    const goal = getGoal();
    const showAvg = statsRange === "week" || statsRange === "month";
    const avg = Math.round(t.calories / Math.max(1, b.days));
    const mfLabel = mf === "All" ? "" : ` · ${mf}`;
    $("stats-summary").innerHTML =
      `<div><span class="stats-sum-total">${t.calories}</span><span class="stats-sum-unit">kcal ${b.label}${mfLabel}</span></div>
       ${showAvg
        ? `<div class="stats-sum-sub">Daily average: <strong>${avg}</strong> kcal · goal ${goal}</div>`
        : `<div class="stats-sum-sub">Daily goal ${goal} kcal</div>`}
       <div class="stats-sum-macros"><span class="p">P ${Math.round(t.protein)}g</span><span class="c">C ${Math.round(t.carbs)}g</span><span class="f">F ${Math.round(t.fat)}g</span></div>`;

    const history = filterMeal(loadHistory());
    $("chart-over-time").innerHTML = Charts.caloriesOverTime(history, goal);
    $("chart-weekday").innerHTML = Charts.weekdayAverages(history);
    $("chart-category").innerHTML = Charts.breakdownBy(rangeEntries, e => e.category || "Others");
    $("stats-insight").innerHTML = Charts.insights(history);
  }

  $("stats-range").addEventListener("click", e => {
    const pill = e.target.closest(".range-pill");
    if (!pill) return;
    statsRange = pill.dataset.range;
    $("stats-range").querySelectorAll(".range-pill").forEach(p => p.classList.toggle("active", p === pill));
    renderStats();
  });

  $("stats-mealfilter").addEventListener("click", e => {
    const pill = e.target.closest(".range-pill");
    if (!pill) return;
    statsMealFilter = pill.dataset.meal;
    $("stats-mealfilter").querySelectorAll(".range-pill").forEach(p => p.classList.toggle("active", p === pill));
    renderStats();
  });

  /* ---------- manage cuisines sheet ---------- */
  function renderCuisineManage() {
    $("mealcat-list").innerHTML = allCuisines().map(c => {
      const core = isCoreCuisine(c);
      return `<div class="mealcat-row" data-cat="${escAttr(c)}">
         <input type="text" value="${escAttr(c)}" maxlength="30" aria-label="Cuisine name"${core ? " readonly" : ""}>
         ${core ? `<span class="mealcat-core">core</span>` : `<button type="button" class="mealcat-del" aria-label="Delete cuisine">🗑</button>`}
       </div>`;
    }).join("");
  }
  function refreshCuisineUI() { renderCuisineManage(); renderTabs(); renderGrid(); }
  function openCuisineManage() {
    renderCuisineManage();
    $("mealcat-backdrop").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeCuisineManage() {
    $("mealcat-backdrop").hidden = true;
    document.body.style.overflow = "";
  }

  $("btn-manage-cats").addEventListener("click", openCuisineManage);
  $("mealcat-close").addEventListener("click", closeCuisineManage);
  $("mealcat-backdrop").addEventListener("click", e => { if (e.target === $("mealcat-backdrop")) closeCuisineManage(); });
  $("mealcat-add-btn").addEventListener("click", () => {
    const inp = $("mealcat-add-input");
    if (addCuisine(inp.value)) { inp.value = ""; refreshCuisineUI(); }
    else toast("Enter a new, unique cuisine");
  });
  $("mealcat-add-input").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); $("mealcat-add-btn").click(); }
  });
  $("mealcat-list").addEventListener("click", e => {
    const del = e.target.closest(".mealcat-del");
    if (!del) return;
    const cat = del.closest(".mealcat-row").dataset.cat;
    if (confirm(`Delete cuisine "${cat}"? Past logs keep their label.`)) { deleteCuisine(cat); refreshCuisineUI(); }
  });
  $("mealcat-list").addEventListener("change", e => {
    const inp = e.target.closest("input");
    if (!inp || inp.readOnly) return;
    const row = inp.closest(".mealcat-row");
    const oldName = row.dataset.cat;
    const newName = inp.value.trim();
    if (!newName || newName === oldName) { inp.value = oldName; return; }
    if (allCuisines().some(c => c.toLowerCase() === newName.toLowerCase() && c !== oldName)) {
      toast("That cuisine already exists"); inp.value = oldName; return;
    }
    renameCuisine(oldName, newName);
    row.dataset.cat = newName;
    renderTabs(); renderGrid();
  });

  /* ---------- logo → back to home ---------- */
  $("logo-home").addEventListener("click", () => {
    closeModal();
    closeAddFood();
    closeCuisineManage();
    closeReview();
    closeCamera();
    exitPickerMode();
    currentScan = null;
    showScanStage("scan-home");
    showView("scan");
  });

  /* ---------- init ---------- */
  const cuisineNew = name => {
    const ok = addCuisine(name);
    if (ok) { renderTabs(); renderGrid(); }
    return ok;
  };
  // scan-result pickers
  setupPicker("result-cuisine-picker", {
    label: "Cuisine", allowNew: true, newLabel: "New cuisine", newPlaceholder: "e.g. Thai",
    getItems: allCuisines, onNew: cuisineNew,
    getSelected: () => currentScan && currentScan.cuisine,
    setSelected: v => { if (currentScan) currentScan.cuisine = v; },
  });
  setupPicker("result-meal-picker", {
    label: "Meal type", getItems: () => MEAL_TYPES,
    getSelected: () => currentScan && currentScan.mealType,
    setSelected: v => { if (currentScan) currentScan.mealType = v; },
  });
  // library-modal pickers
  setupPicker("modal-cuisine-picker", {
    label: "Cuisine", allowNew: true, newLabel: "New cuisine", newPlaceholder: "e.g. Thai",
    getItems: allCuisines, onNew: cuisineNew,
    getSelected: () => modalState && modalState.cuisine,
    setSelected: v => { if (modalState) modalState.cuisine = v; },
  });
  setupPicker("modal-meal-picker", {
    label: "Meal type", getItems: () => MEAL_TYPES,
    getSelected: () => modalState && modalState.mealType,
    setSelected: v => { if (modalState) modalState.mealType = v; },
  });
  // add-food cuisine picker
  setupPicker("af-cuisine-pills", {
    label: "Cuisine *", allowNew: true, newLabel: "New cuisine", newPlaceholder: "e.g. Thai",
    getItems: allCuisines, onNew: cuisineNew,
    getSelected: () => afCuisine,
    setSelected: v => { afCuisine = v; },
  });

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
