/* ============ CalorieSnap AI classifier ============
   Lazily loads TensorFlow.js + MobileNet from CDN, classifies a photo,
   and maps ImageNet labels onto the built-in food database.
   Fully degrades: if the model can't load (offline), callers get
   { status: "unavailable" } and fall back to manual dish selection.
*/

const Classifier = (() => {
  const TF_URL = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js";
  const MOBILENET_URL = "https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js";

  let modelPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  // Load libraries + model once; subsequent calls reuse the same promise.
  function ensureModel() {
    if (!modelPromise) {
      modelPromise = (async () => {
        if (typeof tf === "undefined") await loadScript(TF_URL);
        if (typeof mobilenet === "undefined") await loadScript(MOBILENET_URL);
        return mobilenet.load({ version: 2, alpha: 1.0 });
      })().catch(err => {
        modelPromise = null; // allow retry on next scan
        throw err;
      });
    }
    return modelPromise;
  }

  // Map MobileNet predictions (top-5) to a dish in the food database.
  // ImageNet class names are comma-separated synonym lists, e.g. "hotdog, hot dog, red hot".
  function matchFood(predictions) {
    for (const pred of predictions) {
      const labels = pred.className.toLowerCase().split(",").map(s => s.trim());
      for (const dish of FOODS) {
        for (const kw of dish.keywords) {
          if (labels.some(l => l === kw || l.includes(kw) || kw.includes(l))) {
            return { dish, confidence: pred.probability, rawLabel: labels[0] };
          }
        }
      }
    }
    return null;
  }

  /* ---- image embeddings (for recognising user-added foods) ---- */

  // L2-normalised MobileNet embedding of an image, as a plain rounded array
  // (~1280 floats ≈ 9KB in localStorage per custom food).
  async function embed(imgEl) {
    const model = await ensureModel();
    const tensor = model.infer(imgEl, true);
    const raw = await tensor.data();
    tensor.dispose();
    let norm = 0;
    for (const v of raw) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    return Array.from(raw, v => Math.round((v / norm) * 10000) / 10000);
  }

  function cosine(a, b) {
    if (!a || !b || a.length !== b.length) return -1;
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot; // both vectors are already L2-normalised
  }

  const CUSTOM_SIM_THRESHOLD = 0.7;

  function matchCustom(embedding, customList) {
    let best = null, bestSim = 0;
    for (const dish of customList) {
      const sim = cosine(embedding, dish.embedding);
      if (sim > bestSim) { bestSim = sim; best = dish; }
    }
    return bestSim >= CUSTOM_SIM_THRESHOLD ? { dish: best, confidence: bestSim } : null;
  }

  /**
   * Classify an <img> element. `customList` = user-added dishes (may carry
   * an `embedding` from the photo they were created with).
   * Resolves to one of:
   *   { status: "match", dish, confidence, rawLabel? }
   *   { status: "nomatch", rawLabel }   — model ran but nothing in our DB matched
   *   { status: "unavailable" }         — model couldn't load (e.g. offline)
   */
  async function classify(imgEl, customList = []) {
    let model;
    try {
      model = await ensureModel();
    } catch (err) {
      console.warn("CalorieSnap: AI model unavailable:", err.message);
      return { status: "unavailable" };
    }
    try {
      const predictions = await model.classify(imgEl, 5);
      console.log("CalorieSnap predictions:", predictions);
      const builtin = matchFood(predictions);

      let custom = null;
      const withEmbeddings = customList.filter(d => Array.isArray(d.embedding));
      if (withEmbeddings.length) {
        custom = matchCustom(await embed(imgEl), withEmbeddings);
      }

      // A visually similar custom food beats a keyword match unless the
      // ImageNet prediction is clearly more confident.
      if (custom && (!builtin || custom.confidence >= builtin.confidence)) {
        return { status: "match", ...custom };
      }
      if (builtin) return { status: "match", ...builtin };
      return { status: "nomatch", rawLabel: predictions[0] ? predictions[0].className.split(",")[0] : "" };
    } catch (err) {
      console.warn("CalorieSnap: classification failed:", err.message);
      return { status: "unavailable" };
    }
  }

  // Kick off model download in the background (non-blocking warm-up).
  function warmUp() {
    ensureModel().catch(() => {}); // errors surface on actual classify
  }

  return { classify, embed, warmUp, ensureModel };
})();
