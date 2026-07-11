/* ============ CalorieSnap online nutrition lookup ============
   Nutrition.lookup(name) → { name, source, calories, protein, carbs, fat,
                              ingredients[], servingNote } or null.
   Sources (both free, no account, CORS-enabled):
     1. USDA FoodData Central (DEMO_KEY — rate-limited, falls through on failure)
     2. Open Food Facts text search
   Values are per serving where the source provides one; otherwise estimated
   from per-100g values for a standard 300g cooked-dish serving (noted to user).
*/

const Nutrition = (() => {
  const USDA_URL = "https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY";
  // Note: the sg. subdomain sends CORS headers (world.'s legacy search often
  // doesn't respond); it also ranks Singapore/Malaysia regional foods first.
  const OFF_HOSTS = ["https://sg.openfoodfacts.org", "https://world.openfoodfacts.org"];
  const OFF_QS = "/cgi/search.pl?search_simple=1&action=process&json=1&page_size=5&fields=product_name,product_name_en,nutriments,serving_size,ingredients_text,image_front_url,image_url";
  const DISH_SERVING_G = 300; // assumed cooked-dish serving when source is per-100g

  const round1 = n => Math.round(n * 10) / 10;

  function fromPer100g(kcal, p, c, f) {
    const m = DISH_SERVING_G / 100;
    return {
      calories: Math.round(kcal * m),
      protein: round1(p * m), carbs: round1(c * m), fat: round1(f * m),
      servingNote: `Estimated for a ${DISH_SERVING_G}g serving — adjust if needed`,
    };
  }

  function splitIngredients(text) {
    if (!text) return [];
    return text.split(/[,;]|\band\b/i)
      .map(s => s.replace(/\(.*?\)/g, "").replace(/[\d%.()]+/g, "").trim())
      .filter(s => s.length > 1 && s.length < 40)
      .slice(0, 12)
      .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
  }

  /* ---- USDA FoodData Central ---- */
  async function usda(query) {
    const url = `${USDA_URL}&query=${encodeURIComponent(query)}&pageSize=5`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("USDA " + resp.status);
    const data = await resp.json();
    // USDA fuzzy search happily returns unrelated foods (e.g. "chow mein
    // noodles" for "chow kway teow") — require most query words to actually
    // appear in the description, otherwise let Open Food Facts try instead.
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const relevant = f => {
      const desc = (f.description || "").toLowerCase();
      const hits = tokens.filter(t => desc.includes(t)).length;
      return tokens.length === 0 || hits / tokens.length >= 0.6;
    };
    const food = (data.foods || []).find(f => f.foodNutrients && f.foodNutrients.length && relevant(f));
    if (!food) return null;

    const nut = num => {
      const n = food.foodNutrients.find(x => x.nutrientNumber === num || String(x.nutrientId) === num);
      return n ? n.value : 0;
    };
    const kcal = nut("208"), protein = nut("203"), fat = nut("204"), carbs = nut("205");
    if (!kcal) return null;

    let vals;
    if (food.servingSize && food.servingSizeUnit && /g|ml/i.test(food.servingSizeUnit)) {
      const m = food.servingSize / 100;
      vals = {
        calories: Math.round(kcal * m),
        protein: round1(protein * m), carbs: round1(carbs * m), fat: round1(fat * m),
        servingNote: `Per ${food.servingSize}${food.servingSizeUnit.toLowerCase()} serving`,
      };
    } else {
      vals = fromPer100g(kcal, protein, carbs, fat);
    }
    return {
      name: (food.description || query).toLowerCase(),
      source: "USDA FoodData Central",
      ingredients: splitIngredients(food.ingredients),
      ...vals,
    };
  }

  /* ---- Open Food Facts ---- */
  async function off(query) {
    let data = null;
    for (const host of OFF_HOSTS) {
      try {
        const resp = await fetch(`${host}${OFF_QS}&search_terms=${encodeURIComponent(query)}`);
        if (resp.ok) { data = await resp.json(); break; }
      } catch { /* try next host */ }
    }
    if (!data) throw new Error("Open Food Facts unreachable");
    const prod = (data.products || []).find(p => p.nutriments && p.nutriments["energy-kcal_100g"] > 0);
    if (!prod) return null;

    const n = prod.nutriments;
    let vals;
    if (n["energy-kcal_serving"] > 0) {
      vals = {
        calories: Math.round(n["energy-kcal_serving"]),
        protein: round1(n["proteins_serving"] || 0),
        carbs: round1(n["carbohydrates_serving"] || 0),
        fat: round1(n["fat_serving"] || 0),
        servingNote: prod.serving_size ? `Per serving (${prod.serving_size})` : "Per serving",
      };
    } else {
      vals = fromPer100g(n["energy-kcal_100g"], n["proteins_100g"] || 0, n["carbohydrates_100g"] || 0, n["fat_100g"] || 0);
    }
    return {
      name: prod.product_name_en || prod.product_name || query,
      source: "Open Food Facts",
      ingredients: splitIngredients(prod.ingredients_text),
      image: prod.image_front_url || prod.image_url || null,
      ...vals,
    };
  }

  /* ---- web image for a dish name (Wikipedia article lead image) ---- */
  // Same source the bundled library photos came from; the REST summary
  // endpoint is CORS-enabled. Returns an image URL or null.
  async function fetchImage(name) {
    try {
      const t = encodeURIComponent(name.trim().replace(/\s+/g, "_"));
      const resp = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${t}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      const url = (data.thumbnail && data.thumbnail.source) || (data.originalimage && data.originalimage.source) || null;
      return url && !/\.svg/i.test(url) ? url : null;
    } catch {
      return null;
    }
  }

  /* ---- public ---- */
  // Sources AND-match query words, so spelling variants find nothing
  // ("Chow Kway Teow" vs products named "Char Kway Teow"). If the full
  // name misses, relax the query by dropping the first / last word.
  function candidateQueries(name) {
    const tokens = name.trim().split(/\s+/);
    const queries = [name.trim()];
    if (tokens.length >= 3) {
      queries.push(tokens.slice(1).join(" "));
      queries.push(tokens.slice(0, -1).join(" "));
    }
    return queries;
  }

  async function lookup(name) {
    // Keep the first (most relevant) hit's nutrition, but if it has no
    // ingredient list (USDA generic foods usually don't), keep searching
    // the other source just to borrow ingredients from it.
    let best = null;
    let attempts = 0, failures = 0;
    for (const query of candidateQueries(name)) {
      for (const source of [usda, off]) {
        attempts++;
        try {
          const hit = await source(query);
          if (!hit) continue;
          if (!best) best = hit;
          else if (!best.ingredients.length && hit.ingredients.length) best.ingredients = hit.ingredients;
          if (best.ingredients.length) return best;
        } catch (err) {
          failures++;
          console.warn("Nutrition lookup:", err.message);
        }
      }
    }
    // Every source errored (rate limit / outage) vs. a genuine "not found" —
    // callers show different messages for each.
    if (!best && failures === attempts) throw new Error("all nutrition sources unavailable");
    // Attach a dish photo when the nutrition source didn't provide one
    // (USDA never does; Wikipedia covers dishes like "Mee Soto").
    if (best && !best.image) best.image = await fetchImage(name);
    return best;
  }

  return { lookup, fetchImage };
})();
