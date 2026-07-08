/* ============ CalorieSnap food database ============
   Each dish: id, name, category, calories/protein/carbs/fat (per medium serving),
   servingDesc, ingredients[] (incl. condiments), keywords[] (lowercase ImageNet
   class names for AI matching), img (bundled photo path).
   User-created foods are stored in localStorage and merged in at runtime (see app.js).
*/

const CATEGORIES = ["Chinese", "Malay", "Indian", "American", "Italian", "Mexican", "Others", "Healthy"];

// Fixed, mandatory meal-time tags assigned to every logged entry.
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];

const FOODS = [
  /* ================= CHINESE ================= */
  { id: "fried-rice", name: "Fried Rice", category: "Chinese", calories: 520, protein: 14, carbs: 68, fat: 20,
    servingDesc: "1 plate (~350g) with egg and char siu",
    ingredients: ["White rice", "Egg", "Char siu pork", "Spring onion", "Peas", "Carrot", "Soy sauce", "Sesame oil", "Garlic"],
    keywords: ["fried rice", "wok", "plate"], img: "images/fried-rice.jpg" },

  { id: "sweet-sour-pork", name: "Sweet & Sour Pork", category: "Chinese", calories: 430, protein: 22, carbs: 42, fat: 19,
    servingDesc: "1 serving (~250g) with pineapple and peppers",
    ingredients: ["Pork loin", "Pineapple", "Bell pepper", "Onion", "Tomato ketchup", "Vinegar", "Sugar", "Corn starch batter"],
    keywords: ["sweet and sour", "plate"], img: "images/sweet-sour-pork.jpg" },

  { id: "dumplings", name: "Pork Dumplings", category: "Chinese", calories: 390, protein: 18, carbs: 45, fat: 15,
    servingDesc: "6 steamed dumplings with soy dip",
    ingredients: ["Wheat flour wrapper", "Minced pork", "Chinese cabbage", "Ginger", "Spring onion", "Soy sauce", "Black vinegar dip", "Chilli oil"],
    keywords: ["dumpling", "dough"], img: "images/dumplings.jpg" },

  { id: "chow-mein", name: "Chicken Chow Mein", category: "Chinese", calories: 510, protein: 24, carbs: 60, fat: 18,
    servingDesc: "1 plate (~320g) stir-fried noodles",
    ingredients: ["Egg noodles", "Chicken breast", "Bean sprouts", "Cabbage", "Carrot", "Oyster sauce", "Soy sauce", "Sesame oil"],
    keywords: ["noodle", "wok", "carbonara"], img: "images/chow-mein.jpg" },

  { id: "spring-rolls", name: "Spring Rolls", category: "Chinese", calories: 320, protein: 8, carbs: 34, fat: 17,
    servingDesc: "3 fried spring rolls with sweet chilli",
    ingredients: ["Spring roll pastry", "Cabbage", "Carrot", "Glass noodles", "Mushroom", "Garlic", "Sweet chilli sauce", "Cooking oil"],
    keywords: ["spring roll", "french loaf"], img: "images/spring-rolls.jpg" },

  { id: "kung-pao", name: "Kung Pao Chicken", category: "Chinese", calories: 480, protein: 30, carbs: 28, fat: 27,
    servingDesc: "1 serving (~280g) with peanuts and rice",
    ingredients: ["Chicken thigh", "Roasted peanuts", "Dried chillies", "Sichuan peppercorn", "Spring onion", "Garlic", "Soy sauce", "Rice vinegar", "Sugar"],
    keywords: ["kung pao", "plate"], img: "images/kung-pao.jpg" },

  { id: "wonton-soup", name: "Wonton Noodle Soup", category: "Chinese", calories: 420, protein: 20, carbs: 52, fat: 13,
    servingDesc: "1 bowl (~450g) with 4 wontons",
    ingredients: ["Egg noodles", "Pork & prawn wontons", "Chicken broth", "Choy sum", "Spring onion", "White pepper", "Sesame oil"],
    keywords: ["soup bowl", "hot pot", "consomme"], img: "images/wonton-soup.jpg" },

  /* ================= MALAY ================= */
  { id: "nasi-lemak", name: "Nasi Lemak", category: "Malay", calories: 640, protein: 23, carbs: 72, fat: 29,
    servingDesc: "1 plate with fried chicken, egg, sambal, anchovies",
    ingredients: ["Coconut rice", "Fried chicken", "Sambal chilli", "Fried anchovies (ikan bilis)", "Roasted peanuts", "Boiled egg", "Cucumber slices"],
    keywords: ["nasi lemak", "plate"], img: "images/nasi-lemak.jpg" },

  { id: "satay", name: "Chicken Satay", category: "Malay", calories: 380, protein: 28, carbs: 18, fat: 22,
    servingDesc: "6 sticks with peanut sauce and ketupat",
    ingredients: ["Chicken skewers", "Peanut sauce", "Ketupat rice cake", "Cucumber", "Red onion", "Turmeric marinade", "Lemongrass"],
    keywords: ["satay", "skewer"], img: "images/satay.jpg" },

  { id: "mee-goreng", name: "Mee Goreng", category: "Malay", calories: 560, protein: 18, carbs: 70, fat: 23,
    servingDesc: "1 plate (~350g) spicy fried noodles",
    ingredients: ["Yellow noodles", "Egg", "Tofu", "Bean sprouts", "Potato", "Chilli paste", "Tomato sauce", "Lime", "Shallots"],
    keywords: ["mee goreng", "noodle", "carbonara"], img: "images/mee-goreng.jpg" },

  { id: "rendang", name: "Beef Rendang", category: "Malay", calories: 470, protein: 32, carbs: 12, fat: 33,
    servingDesc: "1 serving (~220g) slow-cooked in coconut",
    ingredients: ["Beef chuck", "Coconut milk", "Toasted grated coconut (kerisik)", "Lemongrass", "Galangal", "Turmeric leaf", "Dried chillies", "Kaffir lime leaf"],
    keywords: ["rendang", "meat loaf"], img: "images/rendang.jpg" },

  { id: "nasi-goreng", name: "Nasi Goreng Kampung", category: "Malay", calories: 600, protein: 20, carbs: 74, fat: 25,
    servingDesc: "1 plate with fried egg and keropok",
    ingredients: ["White rice", "Fried egg", "Anchovies", "Kangkung (water spinach)", "Chilli paste (sambal belacan)", "Shallots", "Garlic", "Keropok crackers"],
    keywords: ["nasi goreng", "fried rice", "wok"], img: "images/nasi-goreng.jpg" },

  { id: "laksa", name: "Laksa", category: "Malay", calories: 590, protein: 24, carbs: 58, fat: 30,
    servingDesc: "1 bowl (~500g) curry noodle soup",
    ingredients: ["Thick rice noodles", "Coconut curry broth", "Prawns", "Fish cake", "Tofu puffs", "Bean sprouts", "Laksa leaf", "Sambal", "Boiled egg"],
    keywords: ["laksa", "soup bowl", "hot pot"], img: "images/laksa.jpg" },

  { id: "roti-john", name: "Roti John", category: "Malay", calories: 520, protein: 21, carbs: 55, fat: 24,
    servingDesc: "1 loaf omelette sandwich with minced meat",
    ingredients: ["Baguette", "Egg", "Minced mutton or chicken", "Onion", "Chilli sauce", "Mayonnaise", "Cucumber"],
    keywords: ["roti john", "french loaf", "hotdog"], img: "images/roti-john.jpg" },

  /* ================= INDIAN ================= */
  { id: "biryani", name: "Chicken Biryani", category: "Indian", calories: 650, protein: 30, carbs: 78, fat: 24,
    servingDesc: "1 plate (~400g) with raita",
    ingredients: ["Basmati rice", "Chicken", "Yogurt", "Fried onions", "Saffron", "Garam masala", "Mint", "Coriander", "Ghee", "Raita"],
    keywords: ["biryani", "plate", "pilaf"], img: "images/biryani.jpg" },

  { id: "butter-chicken", name: "Butter Chicken", category: "Indian", calories: 490, protein: 28, carbs: 20, fat: 33,
    servingDesc: "1 bowl (~280g) creamy tomato gravy",
    ingredients: ["Tandoori chicken", "Tomato purée", "Butter", "Cream", "Cashew paste", "Fenugreek leaves", "Garam masala", "Ginger-garlic paste"],
    keywords: ["butter chicken", "curry"], img: "images/butter-chicken.jpg" },

  { id: "roti-prata", name: "Roti Prata", category: "Indian", calories: 440, protein: 9, carbs: 56, fat: 20,
    servingDesc: "2 pieces with fish curry dip",
    ingredients: ["Wheat flour dough", "Ghee", "Fish curry dip", "Dhal curry", "Sugar (optional)"],
    keywords: ["prata", "dough", "pancake"], img: "images/roti-prata.jpg" },

  { id: "tandoori", name: "Tandoori Chicken", category: "Indian", calories: 350, protein: 38, carbs: 8, fat: 18,
    servingDesc: "2 pieces with mint chutney",
    ingredients: ["Chicken leg", "Yogurt marinade", "Tandoori masala", "Kashmiri chilli", "Lemon", "Mint chutney", "Sliced onions"],
    keywords: ["tandoori", "drumstick"], img: "images/tandoori.jpg" },

  { id: "palak-paneer", name: "Palak Paneer", category: "Indian", calories: 420, protein: 18, carbs: 16, fat: 32,
    servingDesc: "1 bowl (~250g) spinach with cottage cheese",
    ingredients: ["Spinach purée", "Paneer (cottage cheese)", "Cream", "Onion", "Tomato", "Cumin", "Garlic", "Garam masala"],
    keywords: ["palak", "paneer", "guacamole"], img: "images/palak-paneer.jpg" },

  { id: "samosa", name: "Samosa", category: "Indian", calories: 300, protein: 6, carbs: 32, fat: 17,
    servingDesc: "2 pieces with tamarind chutney",
    ingredients: ["Pastry shell", "Spiced potato", "Green peas", "Cumin seeds", "Coriander", "Tamarind chutney", "Cooking oil"],
    keywords: ["samosa", "potpie"], img: "images/samosa.jpg" },

  { id: "dal-curry", name: "Dal Curry", category: "Indian", calories: 280, protein: 14, carbs: 40, fat: 8,
    servingDesc: "1 bowl (~250g) lentil curry",
    ingredients: ["Red lentils", "Turmeric", "Cumin", "Mustard seeds", "Curry leaves", "Tomato", "Onion", "Ghee tempering"],
    keywords: ["dal", "lentil", "consomme"], img: "images/dal-curry.jpg" },

  /* ================= AMERICAN ================= */
  { id: "cheeseburger", name: "Cheeseburger", category: "American", calories: 550, protein: 27, carbs: 45, fat: 29,
    servingDesc: "1 burger with beef patty and cheese",
    ingredients: ["Sesame bun", "Beef patty", "Cheddar cheese", "Lettuce", "Tomato", "Pickles", "Onion", "Ketchup", "Mustard"],
    keywords: ["cheeseburger", "hamburger"], img: "images/cheeseburger.jpg" },

  { id: "hot-dog", name: "Hot Dog", category: "American", calories: 400, protein: 14, carbs: 33, fat: 24,
    servingDesc: "1 hot dog with mustard",
    ingredients: ["Hot dog bun", "Beef frankfurter", "Mustard", "Ketchup", "Fried onions", "Relish"],
    keywords: ["hotdog", "hot dog"], img: "images/hot-dog.jpg" },

  { id: "fried-chicken", name: "Fried Chicken", category: "American", calories: 480, protein: 34, carbs: 18, fat: 30,
    servingDesc: "2 pieces, crispy fried",
    ingredients: ["Chicken pieces", "Buttermilk marinade", "Seasoned flour", "Paprika", "Black pepper", "Garlic powder", "Frying oil"],
    keywords: ["fried chicken", "drumstick"], img: "images/fried-chicken.jpg" },

  { id: "mac-cheese", name: "Mac & Cheese", category: "American", calories: 470, protein: 18, carbs: 48, fat: 23,
    servingDesc: "1 bowl (~300g) baked with cheddar",
    ingredients: ["Macaroni pasta", "Cheddar cheese", "Milk", "Butter", "Flour (roux)", "Breadcrumb topping", "Mustard powder"],
    keywords: ["macaroni", "carbonara"], img: "images/mac-cheese.jpg" },

  { id: "bbq-ribs", name: "BBQ Ribs", category: "American", calories: 620, protein: 40, carbs: 24, fat: 40,
    servingDesc: "Half rack with BBQ sauce",
    ingredients: ["Pork ribs", "BBQ sauce", "Brown sugar rub", "Smoked paprika", "Garlic powder", "Apple cider vinegar", "Coleslaw side"],
    keywords: ["ribs", "meat loaf", "spare ribs"], img: "images/bbq-ribs.jpg" },

  { id: "meatloaf", name: "Meatloaf", category: "American", calories: 390, protein: 28, carbs: 20, fat: 22,
    servingDesc: "2 slices with gravy",
    ingredients: ["Ground beef", "Breadcrumbs", "Egg", "Onion", "Ketchup glaze", "Worcestershire sauce", "Herbs"],
    keywords: ["meat loaf", "meatloaf"], img: "images/meatloaf.jpg" },

  { id: "pancakes", name: "Pancakes", category: "American", calories: 430, protein: 10, carbs: 62, fat: 16,
    servingDesc: "Stack of 3 with maple syrup and butter",
    ingredients: ["Flour", "Egg", "Milk", "Baking powder", "Butter", "Maple syrup", "Vanilla"],
    keywords: ["pancake", "dough", "trifle"], img: "images/pancakes.jpg" },

  { id: "french-fries", name: "French Fries", category: "American", calories: 365, protein: 4, carbs: 48, fat: 17,
    servingDesc: "1 medium serving (~120g)",
    ingredients: ["Potatoes", "Frying oil", "Salt", "Ketchup"],
    keywords: ["french fries", "fries"], img: "images/french-fries.jpg" },

  /* ================= ITALIAN ================= */
  { id: "pizza", name: "Margherita Pizza", category: "Italian", calories: 570, protein: 24, carbs: 66, fat: 24,
    servingDesc: "2 slices (~200g) of a 12\" pizza",
    ingredients: ["Pizza dough", "Tomato sauce", "Mozzarella", "Fresh basil", "Olive oil", "Oregano"],
    keywords: ["pizza", "pizza pie"], img: "images/pizza.jpg" },

  { id: "spaghetti-bolognese", name: "Spaghetti Bolognese", category: "Italian", calories: 650, protein: 28, carbs: 74, fat: 26,
    servingDesc: "1 plate (~400g) with beef ragù",
    ingredients: ["Spaghetti", "Ground beef", "Tomato passata", "Onion", "Carrot", "Celery", "Red wine", "Parmesan", "Olive oil"],
    keywords: ["carbonara", "spaghetti", "bolognese"], img: "images/spaghetti-bolognese.jpg" },

  { id: "carbonara", name: "Spaghetti Carbonara", category: "Italian", calories: 590, protein: 24, carbs: 64, fat: 27,
    servingDesc: "1 plate (~350g) with egg, pecorino, pancetta",
    ingredients: ["Spaghetti", "Egg yolk", "Pecorino Romano", "Pancetta", "Black pepper"],
    keywords: ["carbonara"], img: "images/carbonara.jpg" },

  { id: "lasagna", name: "Lasagna", category: "Italian", calories: 600, protein: 30, carbs: 50, fat: 31,
    servingDesc: "1 slice (~320g) with béchamel",
    ingredients: ["Lasagne sheets", "Beef ragù", "Béchamel sauce", "Mozzarella", "Parmesan", "Tomato", "Nutmeg"],
    keywords: ["lasagna", "meat loaf"], img: "images/lasagna.jpg" },

  { id: "risotto", name: "Mushroom Risotto", category: "Italian", calories: 480, protein: 12, carbs: 62, fat: 20,
    servingDesc: "1 plate (~300g) creamy arborio rice",
    ingredients: ["Arborio rice", "Mushrooms", "Vegetable stock", "White wine", "Parmesan", "Butter", "Shallots", "Parsley"],
    keywords: ["risotto", "mushroom"], img: "images/risotto.jpg" },

  { id: "tiramisu", name: "Tiramisu", category: "Italian", calories: 450, protein: 8, carbs: 46, fat: 27,
    servingDesc: "1 slice (~150g)",
    ingredients: ["Ladyfinger biscuits", "Mascarpone", "Espresso", "Egg", "Sugar", "Cocoa powder", "Marsala (optional)"],
    keywords: ["tiramisu", "trifle", "chocolate sauce", "ice cream"], img: "images/tiramisu.jpg" },

  { id: "minestrone", name: "Minestrone Soup", category: "Italian", calories: 230, protein: 10, carbs: 34, fat: 6,
    servingDesc: "1 bowl (~350g) vegetable soup",
    ingredients: ["Vegetable broth", "Cannellini beans", "Tomato", "Zucchini", "Carrot", "Celery", "Small pasta", "Olive oil", "Parmesan rind"],
    keywords: ["minestrone", "consomme", "soup bowl"], img: "images/minestrone.jpg" },

  /* ================= MEXICAN ================= */
  { id: "burrito", name: "Burrito", category: "Mexican", calories: 630, protein: 26, carbs: 72, fat: 27,
    servingDesc: "1 large burrito with beans, rice, beef",
    ingredients: ["Flour tortilla", "Seasoned beef", "Mexican rice", "Black beans", "Cheese", "Sour cream", "Salsa", "Guacamole"],
    keywords: ["burrito"], img: "images/burrito.jpg" },

  { id: "tacos", name: "Tacos", category: "Mexican", calories: 450, protein: 21, carbs: 42, fat: 22,
    servingDesc: "3 tacos with beef, salsa, lettuce",
    ingredients: ["Corn tortillas", "Seasoned ground beef", "Lettuce", "Tomato salsa", "Cheese", "Sour cream", "Lime", "Coriander"],
    keywords: ["taco"], img: "images/tacos.jpg" },

  { id: "quesadilla", name: "Quesadilla", category: "Mexican", calories: 520, protein: 24, carbs: 44, fat: 28,
    servingDesc: "1 folded tortilla with cheese and chicken",
    ingredients: ["Flour tortilla", "Melted cheese", "Grilled chicken", "Bell pepper", "Onion", "Salsa", "Sour cream dip"],
    keywords: ["quesadilla", "pizza"], img: "images/quesadilla.jpg" },

  { id: "nachos", name: "Nachos", category: "Mexican", calories: 610, protein: 18, carbs: 58, fat: 35,
    servingDesc: "1 sharing plate with cheese and jalapeños",
    ingredients: ["Tortilla chips", "Melted cheese sauce", "Jalapeños", "Refried beans", "Pico de gallo", "Sour cream", "Guacamole"],
    keywords: ["nacho", "guacamole"], img: "images/nachos.jpg" },

  { id: "guacamole", name: "Guacamole & Chips", category: "Mexican", calories: 350, protein: 5, carbs: 32, fat: 24,
    servingDesc: "1 bowl guac with tortilla chips",
    ingredients: ["Avocado", "Lime juice", "Tomato", "Red onion", "Coriander", "Jalapeño", "Salt", "Tortilla chips"],
    keywords: ["guacamole"], img: "images/guacamole.jpg" },

  { id: "enchiladas", name: "Enchiladas", category: "Mexican", calories: 540, protein: 25, carbs: 48, fat: 28,
    servingDesc: "2 rolled tortillas with red sauce and cheese",
    ingredients: ["Corn tortillas", "Shredded chicken", "Red enchilada sauce", "Cheese", "Onion", "Sour cream", "Coriander"],
    keywords: ["enchilada", "burrito"], img: "images/enchiladas.jpg" },

  { id: "fajitas", name: "Chicken Fajitas", category: "Mexican", calories: 460, protein: 32, carbs: 36, fat: 21,
    servingDesc: "1 sizzling plate with peppers and tortillas",
    ingredients: ["Chicken strips", "Bell peppers", "Onion", "Fajita seasoning", "Flour tortillas", "Lime", "Sour cream", "Salsa"],
    keywords: ["fajita", "wok"], img: "images/fajitas.jpg" },

  /* ================= OTHERS ================= */
  { id: "sushi", name: "Sushi Platter", category: "Others", calories: 400, protein: 20, carbs: 62, fat: 8,
    servingDesc: "8 pieces of assorted sushi",
    ingredients: ["Sushi rice", "Nori seaweed", "Salmon", "Tuna", "Cucumber", "Rice vinegar", "Wasabi", "Pickled ginger", "Soy sauce"],
    keywords: ["sushi", "plate"], img: "images/sushi.jpg" },

  { id: "sashimi", name: "Salmon Sashimi", category: "Others", calories: 220, protein: 30, carbs: 2, fat: 11,
    servingDesc: "8 slices of fresh salmon",
    ingredients: ["Fresh salmon", "Daikon radish", "Shiso leaf", "Wasabi", "Soy sauce"],
    keywords: ["sashimi", "salmon"], img: "images/sashimi.jpg" },

  { id: "ramen", name: "Ramen", category: "Others", calories: 550, protein: 26, carbs: 66, fat: 20,
    servingDesc: "1 bowl (~550g) with chashu and egg",
    ingredients: ["Ramen noodles", "Pork bone broth", "Chashu pork", "Soft-boiled egg", "Nori", "Spring onion", "Bamboo shoots", "Miso or shoyu tare"],
    keywords: ["ramen", "soup bowl", "hot pot", "consomme"], img: "images/ramen.jpg" },

  { id: "pad-thai", name: "Pad Thai", category: "Others", calories: 580, protein: 22, carbs: 70, fat: 24,
    servingDesc: "1 plate (~350g) with prawns and peanuts",
    ingredients: ["Rice noodles", "Prawns", "Egg", "Tofu", "Bean sprouts", "Tamarind sauce", "Fish sauce", "Crushed peanuts", "Lime", "Chilli flakes"],
    keywords: ["pad thai", "noodle", "carbonara"], img: "images/pad-thai.jpg" },

  { id: "tom-yum", name: "Tom Yum Soup", category: "Others", calories: 250, protein: 18, carbs: 20, fat: 11,
    servingDesc: "1 bowl (~400g) with prawns",
    ingredients: ["Prawns", "Lemongrass", "Galangal", "Kaffir lime leaves", "Bird's eye chilli", "Fish sauce", "Lime juice", "Mushrooms", "Coriander"],
    keywords: ["tom yum", "consomme", "soup bowl", "hot pot"], img: "images/tom-yum.jpg" },

  { id: "bibimbap", name: "Bibimbap", category: "Others", calories: 560, protein: 24, carbs: 68, fat: 21,
    servingDesc: "1 stone bowl with rice, veggies, egg",
    ingredients: ["Steamed rice", "Fried egg", "Beef bulgogi", "Spinach", "Carrot", "Bean sprouts", "Shiitake", "Gochujang sauce", "Sesame oil"],
    keywords: ["bibimbap", "hot pot", "plate"], img: "images/bibimbap.jpg" },

  { id: "fish-chips", name: "Fish & Chips", category: "Others", calories: 720, protein: 32, carbs: 66, fat: 37,
    servingDesc: "1 battered fillet with chips",
    ingredients: ["White fish fillet", "Beer batter", "Potato chips", "Mushy peas", "Tartar sauce", "Lemon wedge", "Malt vinegar"],
    keywords: ["fish and chips", "french fries"], img: "images/fish-chips.jpg" },

  { id: "kimchi-fried-rice", name: "Kimchi Fried Rice", category: "Others", calories: 490, protein: 15, carbs: 64, fat: 19,
    servingDesc: "1 plate with fried egg on top",
    ingredients: ["Steamed rice", "Kimchi", "Fried egg", "Spam or pork belly", "Gochujang", "Spring onion", "Sesame oil", "Seaweed flakes"],
    keywords: ["kimchi", "fried rice", "wok"], img: "images/kimchi-fried-rice.jpg" },

  /* ================= HEALTHY ================= */
  { id: "caesar-salad", name: "Caesar Salad", category: "Healthy", calories: 320, protein: 22, carbs: 14, fat: 20,
    servingDesc: "1 bowl with grilled chicken",
    ingredients: ["Romaine lettuce", "Grilled chicken", "Croutons", "Parmesan", "Caesar dressing", "Anchovy", "Black pepper"],
    keywords: ["salad", "head cabbage", "broccoli"], img: "images/caesar-salad.jpg" },

  { id: "greek-salad", name: "Greek Salad", category: "Healthy", calories: 280, protein: 9, carbs: 16, fat: 21,
    servingDesc: "1 bowl with feta and olives",
    ingredients: ["Tomato", "Cucumber", "Feta cheese", "Kalamata olives", "Red onion", "Green pepper", "Olive oil", "Oregano"],
    keywords: ["salad", "cucumber", "bell pepper"], img: "images/greek-salad.jpg" },

  { id: "grilled-chicken", name: "Grilled Chicken Breast", category: "Healthy", calories: 250, protein: 42, carbs: 2, fat: 8,
    servingDesc: "1 breast (~180g) with herbs",
    ingredients: ["Chicken breast", "Olive oil", "Garlic", "Rosemary", "Thyme", "Lemon", "Black pepper", "Sea salt"],
    keywords: ["grilled chicken", "plate"], img: "images/grilled-chicken.jpg" },

  { id: "fruit-bowl", name: "Fruit Bowl", category: "Healthy", calories: 180, protein: 2, carbs: 44, fat: 1,
    servingDesc: "1 bowl mixed fresh fruit (~300g)",
    ingredients: ["Watermelon", "Pineapple", "Banana", "Apple", "Grapes", "Strawberries", "Orange"],
    keywords: ["banana", "strawberry", "orange", "pineapple", "granny smith", "fig", "pomegranate", "custard apple", "lemon"], img: "images/fruit-bowl.jpg" },

  { id: "quinoa-bowl", name: "Quinoa Power Bowl", category: "Healthy", calories: 420, protein: 18, carbs: 52, fat: 16,
    servingDesc: "1 bowl with chickpeas, avocado, veg",
    ingredients: ["Quinoa", "Chickpeas", "Avocado", "Cherry tomatoes", "Baby spinach", "Roasted sweet potato", "Tahini dressing", "Pumpkin seeds"],
    keywords: ["quinoa", "plate", "guacamole"], img: "images/quinoa-bowl.jpg" },

  { id: "salmon-broccoli", name: "Steamed Salmon & Broccoli", category: "Healthy", calories: 380, protein: 36, carbs: 10, fat: 22,
    servingDesc: "1 fillet (~160g) with steamed broccoli",
    ingredients: ["Salmon fillet", "Broccoli", "Lemon", "Olive oil", "Garlic", "Dill", "Sea salt"],
    keywords: ["broccoli", "salmon", "cauliflower"], img: "images/salmon-broccoli.jpg" },

  { id: "avocado-toast", name: "Avocado Toast", category: "Healthy", calories: 340, protein: 10, carbs: 34, fat: 19,
    servingDesc: "2 slices wholegrain with poached egg",
    ingredients: ["Wholegrain bread", "Avocado", "Poached egg", "Lemon juice", "Chilli flakes", "Olive oil", "Sea salt"],
    keywords: ["avocado", "guacamole", "bagel", "french loaf"], img: "images/avocado-toast.jpg" },

  { id: "smoothie-bowl", name: "Berry Smoothie Bowl", category: "Healthy", calories: 310, protein: 9, carbs: 54, fat: 8,
    servingDesc: "1 bowl with granola and fresh berries",
    ingredients: ["Frozen mixed berries", "Banana", "Greek yogurt", "Granola", "Chia seeds", "Honey", "Fresh strawberries", "Blueberries"],
    keywords: ["strawberry", "banana", "trifle", "ice cream"], img: "images/smoothie-bowl.jpg" },
];

const PORTIONS = [
  { key: "S", label: "Small portion", mult: 0.75, name: "Small", caption: "Snack-sized" },
  { key: "M", label: "Medium portion", mult: 1.0, name: "Medium", caption: "Standard plate" },
  { key: "L", label: "Large portion", mult: 1.5, name: "Large", caption: "Generous serving" },
];

// Cooking-method adjustment applied to calories and fat
// (e.g. a boiled chicken breast vs the same breast deep-fried).
const PREP_METHODS = [
  { key: "as-served", label: "As served", mult: 1.0 },
  { key: "grilled", label: "Grilled", mult: 0.95 },
  { key: "baked", label: "Baked", mult: 1.0 },
  { key: "boiled", label: "Boiled / Steamed", mult: 0.85 },
  { key: "fried", label: "Fried", mult: 1.2 },
  { key: "deep-fried", label: "Deep-fried", mult: 1.35 },
];
