/* ============ CalorieSnap barcode scanning ============
   Barcode.decode(imgEl)  → barcode string or null.
     Uses the native BarcodeDetector API when available (Android/ChromeOS),
     otherwise lazy-loads ZXing from CDN and decodes the still photo.
   Barcode.lookupProduct(code) → product info from Open Food Facts or null.
*/

const Barcode = (() => {
  const ZXING_URL = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
  const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"];

  let zxingPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  // Build candidate canvases: full image, 2x upscale, center band crop.
  // Barcodes photographed at an angle or small in frame need a few attempts.
  function candidates(img) {
    const list = [];
    const make = (w, h, sx, sy, sw, sh) => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      // white underlay — PNGs with transparency would otherwise read as all-black
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      return c;
    };
    const W = img.naturalWidth, H = img.naturalHeight;
    list.push(make(W, H, 0, 0, W, H));
    // white margin around the code — EAN/UPC decoding needs a "quiet zone",
    // which tightly-cropped photos (and generated barcodes) often lack
    const padded = document.createElement("canvas");
    padded.width = Math.round(W * 1.3); padded.height = Math.round(H * 1.3);
    const pctx = padded.getContext("2d");
    pctx.fillStyle = "#fff";
    pctx.fillRect(0, 0, padded.width, padded.height);
    pctx.drawImage(img, Math.round(W * 0.15), Math.round(H * 0.15));
    list.push(padded);
    list.push(make(W * 2, H * 2, 0, 0, W, H));
    list.push(make(W, Math.round(H / 2), 0, Math.round(H / 4), W, Math.round(H / 2))); // center band
    return list;
  }

  async function decodeNative(img) {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const detector = new window.BarcodeDetector({ formats: FORMATS.filter(f => supported.includes(f)) });
    for (const c of candidates(img)) {
      const found = await detector.detect(c);
      if (found.length) return found[0].rawValue;
    }
    return null;
  }

  async function decodeZXing(img) {
    if (!zxingPromise) {
      zxingPromise = loadScript(ZXING_URL).catch(err => { zxingPromise = null; throw err; });
    }
    await zxingPromise;
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    const reader = new ZXing.MultiFormatReader();
    reader.setHints(hints);
    for (const c of candidates(img)) {
      try {
        const luminance = new ZXing.HTMLCanvasElementLuminanceSource(c);
        const binary = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminance));
        const result = reader.decode(binary);
        if (result) return result.getText();
      } catch { /* not found in this candidate — try next */ }
    }
    return null;
  }

  async function decode(img) {
    try {
      if ("BarcodeDetector" in window) {
        const code = await decodeNative(img);
        if (code) return code;
      }
    } catch (err) {
      console.warn("Native barcode detection failed:", err.message);
    }
    try {
      return await decodeZXing(img);
    } catch (err) {
      console.warn("ZXing barcode detection failed:", err.message);
      return null;
    }
  }

  /* ---- Open Food Facts product lookup ---- */
  async function lookupProduct(code) {
    const resp = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const n = p.nutriments || {};

    const round1 = x => Math.round((x || 0) * 10) / 10;
    let vals, servingDesc;
    if (n["energy-kcal_serving"] > 0) {
      vals = {
        calories: Math.round(n["energy-kcal_serving"]),
        protein: round1(n["proteins_serving"]),
        carbs: round1(n["carbohydrates_serving"]),
        fat: round1(n["fat_serving"]),
      };
      servingDesc = "Per serving" + (p.serving_size ? ` (${p.serving_size})` : "");
    } else if (n["energy-kcal_100g"] > 0) {
      vals = {
        calories: Math.round(n["energy-kcal_100g"]),
        protein: round1(n["proteins_100g"]),
        carbs: round1(n["carbohydrates_100g"]),
        fat: round1(n["fat_100g"]),
      };
      servingDesc = "Per 100g — adjust portion for how much you ate";
    } else {
      return null; // product exists but has no nutrition data
    }

    const ingredients = (p.ingredients_text_en || p.ingredients_text || "")
      .split(/[,;]/).map(s => s.replace(/\(.*?\)/g, "").replace(/[\d%._*]+/g, "").trim())
      .filter(s => s.length > 1 && s.length < 40).slice(0, 12)
      .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());

    return {
      code,
      name: p.product_name_en || p.product_name || `Product ${code}`,
      brand: p.brands || "",
      servingDesc,
      ingredients,
      ...vals,
    };
  }

  return { decode, lookupProduct };
})();
