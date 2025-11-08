# Recipe Setup Guide

**Date**: November 8, 2025
**Status**: Ready for execution after MCP server restart

## ⚠️ Important: Restart Required

The new PDF parsing and master data management tools were added to the MCP server. You must **restart Claude Desktop** to load these tools before proceeding.

## 📋 Recipe Data Summary

### 11 Favorite Recipes with Shopping Lists

1. **Spaghetti** (7 ingredients)
2. **Fish and Veg** (4 ingredients)
3. **Mac and Cheese** (4 ingredients)
4. **Beef Stew** (8 ingredients) ⭐ Favorite
5. **Pasta Bake** (6 ingredients) ⭐ Favorite
6. **Tuna Casserole** (6 ingredients) ⭐ Favorite
7. **Mini Pizzas** (7 ingredients) 🍕 Friday special
8. **Sushi** (5 ingredients) ⭐ Favorite
9. **Fried Rice** (4 ingredients) ⭐ Favorite
10. **Hotdogs** (4 ingredients) 🌭 Friday special
11. **Chicken Wraps** (4 ingredients) ⭐ Favorite

**Total Unique Products**: ~45-50 items

---

## 🎯 Implementation Steps

### Step 1: Create Product Groups

```javascript
// Run these commands after restarting Claude Desktop:

grocy_product_group_create({ 
  name: "Produce", 
  description: "Fresh fruits and vegetables" 
})

grocy_product_group_create({ 
  name: "Meat & Seafood", 
  description: "Fresh and frozen meat, poultry, and seafood" 
})

grocy_product_group_create({ 
  name: "Dairy & Eggs", 
  description: "Milk, cheese, eggs, and dairy products" 
})

grocy_product_group_create({ 
  name: "Freezer", 
  description: "Frozen foods and ingredients" 
})

grocy_product_group_create({ 
  name: "Pantry", 
  description: "Dry goods, canned items, and shelf-stable products" 
})

grocy_product_group_create({ 
  name: "Bakery", 
  description: "Bread, buns, wraps, and baked goods" 
})
```

### Step 2: Create Shopping Locations

```javascript
grocy_store_create({ 
  name: "Woolworths", 
  description: "Primary grocery store" 
})

grocy_store_create({ 
  name: "Coles", 
  description: "Alternative for price comparison" 
})
```

### Step 3: List Woolworths Receipts

```javascript
pdf_list_receipts({ 
  directory: "C:\\Users\\Deej\\Downloads\\Woolworths orders",
  recursive: false 
})
```

### Step 4: Extract Sample Receipt

```javascript
// Pick a recent receipt from the list above
pdf_extract_receipt({ 
  file_path: "C:\\Users\\Deej\\Downloads\\Woolworths orders\\[filename].pdf" 
})
```

---

## 🍎 Nutrition Tracking

### Built-in Calories Support

Grocy has a built-in `calories` field that is automatically summed when you add products to recipes. This provides basic calorie tracking out of the box.

### Enhanced Nutrition with Userfields

For detailed nutrition tracking (protein, carbs, fat, fiber, etc.), we use Grocy's userfields system. Userfields allow us to store custom data like:

**Product Userfields**:

- `protein_g` - Protein in grams per 100g
- `carbs_g` - Carbohydrates in grams per 100g
- `fat_g` - Total fat in grams per 100g
- `saturated_fat_g` - Saturated fat per 100g
- `fiber_g` - Dietary fiber per 100g
- `sugar_g` - Sugars per 100g
- `sodium_mg` - Sodium in milligrams per 100g
- `brand` - Product brand name
- `package_size` - Package size (e.g., "500g", "1kg")
- `serving_size` - Standard serving size

**Recipe Userfields**:

- `prep_time_minutes` - Preparation time
- `cook_time_minutes` - Cooking time
- `difficulty` - Easy, Medium, Hard
- `cuisine_type` - Italian, Asian, etc.
- `meal_type` - Breakfast, Lunch, Dinner, Snack
- `is_vegetarian` - Boolean flag
- `is_kid_friendly` - Boolean flag

### Nutrition Calculation Example: Spaghetti Bolognese

```javascript
// Recipe: Spaghetti Bolognese (4 servings)

// Ingredients:
// - 500g Pork & Beef Mince (254 cal/100g) = 1,270 calories
// - 500g Spaghetti (371 cal/100g dry) = 1,855 calories
// - 500g Bolognese Sauce (~60 cal/100g) = 300 calories
// - 1 Brown Onion (~60g edible, 40 cal/100g) = 24 calories

// Total Recipe Calories: 3,449 calories
// Per Serving (4 servings): 862 calories

// To calculate total nutrition:
grocy_nutrition_calculate_recipe({ recipe_id: 1 })

// Manual calculation using userfields:
// Total Protein: (500g × 17.2g) + (500g × 13g) = 86g + 65g = 151g
// Per Serving: 151g ÷ 4 = 37.75g protein per serving
```

### ⚠️ Important Limitation

**Userfields are NOT auto-aggregated** by Grocy. This means:

- ✅ `calories` field IS automatically summed in recipes
- ❌ Userfields (protein_g, carbs_g, etc.) are NOT summed in recipes
- 🔧 You must manually calculate detailed nutrition for recipes
- 💡 Use MCP tools: `grocy_nutrition_calculate_recipe` (planned) for automated calculation

---

## 📊 Product Data (Organized by Category)

### Produce (Location: Refrigerator, Default: 7-14 days)

```javascript
// Brown Onion - $0.59 each (~150g average)
// Nutrition per 100g: 40 cal, 1.1g protein, 9.3g carbs, 1.7g fiber
grocy_product_create({
  name: "Brown Onion",
  location_id: 1, // Refrigerator
  qu_id_stock: 1, // piece
  qu_id_purchase: 1, // piece
  min_stock_amount: 2,
  default_best_before_days: 14,
  product_group_id: 1, // Produce
  calories: 40 // per 100g
})
// Then add detailed nutrition:
grocy_userfield_set({
  entity: "products",
  object_id: 1,
  userfields: {
    protein_g: 1.1,
    carbs_g: 9.3,
    fiber_g: 1.7,
    fat_g: 0.1,
    sugar_g: 4.2,
    serving_size: "100g",
    package_size: "~150g average"
  }
})

// Green Capsicum - $1.98 each (~200g average)
// Nutrition per 100g: 20 cal, 0.9g protein, 4.6g carbs, 1.2g fiber
grocy_product_create({
  name: "Green Capsicum",
  location_id: 1,
  qu_id_stock: 1, // piece
  qu_id_purchase: 1,
  min_stock_amount: 1,
  default_best_before_days: 7,
  product_group_id: 1,
  calories: 20
})
grocy_userfield_set({
  entity: "products",
  object_id: 2,
  userfields: {
    protein_g: 0.9,
    carbs_g: 4.6,
    fiber_g: 1.2,
    fat_g: 0.2,
    sugar_g: 3.2,
    serving_size: "100g",
    package_size: "~200g average"
  }
})

// Celery Sticks - $4.50 per 300g
// Nutrition per 100g: 14 cal, 0.7g protein, 3g carbs, 1.6g fiber
grocy_product_create({
  name: "Celery Sticks",
  location_id: 1,
  qu_id_stock: 2, // grams
  qu_id_purchase: 2,
  min_stock_amount: 300,
  default_best_before_days: 7,
  product_group_id: 1,
  calories: 14
})
grocy_userfield_set({
  entity: "products",
  object_id: 3,
  userfields: {
    protein_g: 0.7,
    carbs_g: 3.0,
    fiber_g: 1.6,
    fat_g: 0.1,
    sugar_g: 1.3,
    serving_size: "100g",
    package_size: "300g"
  }
})

// Leek - $2.90 each
grocy_product_create({
  name: "Leek",
  location_id: 1,
  qu_id_stock: 1, // piece
  min_stock_amount: 1,
  default_best_before_days: 7
})

// White Potato - $0.99 each (~180g average)
// Nutrition per 100g: 77 cal, 2g protein, 17g carbs, 2.2g fiber
grocy_product_create({
  name: "White Potato",
  location_id: 1,
  qu_id_stock: 1, // piece
  qu_id_purchase: 1,
  min_stock_amount: 4,
  default_best_before_days: 14,
  product_group_id: 1,
  calories: 77
})
grocy_userfield_set({
  entity: "products",
  object_id: 6,
  userfields: {
    protein_g: 2.0,
    carbs_g: 17.0,
    fiber_g: 2.2,
    fat_g: 0.1,
    sugar_g: 0.8,
    serving_size: "100g",
    package_size: "~180g average",
    brand: "Woolworths"
  }
})

// Lower Carb Potatoes - $6.00 per 1.5kg
// Nutrition similar to regular potatoes: 77 cal, 2g protein, 17g carbs per 100g
grocy_product_create({
  name: "Lower Carb Potatoes",
  location_id: 1,
  qu_id_stock: 3, // kg
  qu_id_purchase: 3,
  min_stock_amount: 1500,
  default_best_before_days: 14,
  product_group_id: 1,
  calories: 77
})
grocy_userfield_set({
  entity: "products",
  object_id: 7,
  userfields: {
    protein_g: 2.0,
    carbs_g: 17.0,
    fiber_g: 2.2,
    fat_g: 0.1,
    serving_size: "100g",
    package_size: "1.5kg"
  }
})

// Carrots - $2.40 per kg (The Odd Bunch)
// Nutrition per 100g: 41 cal, 0.9g protein, 10g carbs, 2.8g fiber, 95% RDI Vitamin A
grocy_product_create({
  name: "Carrots",
  location_id: 1,
  qu_id_stock: 3, // kg
  qu_id_purchase: 3,
  min_stock_amount: 1000,
  default_best_before_days: 14,
  product_group_id: 1,
  calories: 41
})
grocy_userfield_set({
  entity: "products",
  object_id: 8,
  userfields: {
    protein_g: 0.9,
    carbs_g: 10.0,
    fiber_g: 2.8,
    fat_g: 0.2,
    sugar_g: 4.7,
    serving_size: "100g",
    package_size: "1kg",
    brand: "The Odd Bunch"
  }
})

// Spring Onion - $3.00 per bunch
grocy_product_create({
  name: "Spring Onion",
  location_id: 1,
  qu_id_stock: 1, // piece (bunch)
  min_stock_amount: 1,
  default_best_before_days: 7
})

// Continental Cucumber - $1.00 each (The Odd Bunch)
grocy_product_create({
  name: "Continental Cucumber",
  location_id: 1,
  qu_id_stock: 1, // piece
  min_stock_amount: 2,
  default_best_before_days: 7
})

// Mixed Leaf Salad - $3.00 per 200g
grocy_product_create({
  name: "Mixed Leaf Salad",
  location_id: 1,
  qu_id_stock: 2, // grams
  min_stock_amount: 200,
  default_best_before_days: 5
})
```

### Meat & Seafood (Location: Refrigerator/Freezer, Default: 3-7 days)

```javascript
// Pork & Beef Mince - $6.50 per 500g
// Nutrition per 100g: 254 cal, 17.2g protein, 20g fat, 0.3g carbs
grocy_product_create({
  name: "Pork & Beef Mince",
  location_id: 3, // Freezer
  qu_id_stock: 2, // grams
  qu_id_purchase: 2,
  min_stock_amount: 500,
  default_best_before_days: 7,
  product_group_id: 2, // Meat & Seafood
  calories: 254
})
grocy_userfield_set({
  entity: "products",
  object_id: 11,
  userfields: {
    protein_g: 17.2,
    carbs_g: 0.3,
    fat_g: 20.0,
    saturated_fat_g: 9.0,
    fiber_g: 0,
    serving_size: "100g",
    package_size: "500g",
    brand: "Woolworths"
  }
})

// Beef Chuck Steak - $18.50/kg (Medium 380g-800g)
// Nutrition per 100g: 191 cal, 25g protein, 6.8g fat, 0g carbs
grocy_product_create({
  name: "Beef Chuck Steak",
  location_id: 3, // Freezer
  qu_id_stock: 2, // grams
  qu_id_purchase: 2,
  min_stock_amount: 500,
  default_best_before_days: 7,
  product_group_id: 2,
  calories: 191
})
grocy_userfield_set({
  entity: "products",
  object_id: 12,
  userfields: {
    protein_g: 25.0,
    carbs_g: 0,
    fat_g: 6.8,
    saturated_fat_g: 2.8,
    fiber_g: 0,
    serving_size: "100g",
    package_size: "380-800g",
    brand: "Woolworths"
  }
})

// Middle Bacon - $13.00/kg (360g typical)
// Nutrition per 100g: 246 cal, 15.1g protein, 20.4g fat, 1.2g carbs
grocy_product_create({
  name: "Middle Bacon",
  location_id: 1, // Refrigerator
  qu_id_stock: 2, // grams
  qu_id_purchase: 2,
  min_stock_amount: 200,
  default_best_before_days: 7,
  product_group_id: 2,
  calories: 246
})
grocy_userfield_set({
  entity: "products",
  object_id: 13,
  userfields: {
    protein_g: 15.1,
    carbs_g: 1.2,
    fat_g: 20.4,
    saturated_fat_g: 7.0,
    fiber_g: 0,
    sodium_mg: 900,
    serving_size: "100g",
    package_size: "360g",
    brand: "Woolworths"
  }
})

// Hungarian Salami - $2.65 per 100g
grocy_product_create({
  name: "Hungarian Salami",
  location_id: 1,
  qu_id_stock: 2, // grams
  min_stock_amount: 100,
  default_best_before_days: 14
})

// Ham Steaks - $4.70 per 300g
grocy_product_create({
  name: "Ham Steaks",
  location_id: 1,
  qu_id_stock: 2, // grams
  min_stock_amount: 300,
  default_best_before_days: 7
})

// Frankfurts - $9.50/kg (500g typical)
grocy_product_create({
  name: "Frankfurts",
  location_id: 1,
  qu_id_stock: 2, // grams
  min_stock_amount: 500,
  default_best_before_days: 7
})

// Kransky Cheese - $18.50/kg (300g typical)
grocy_product_create({
  name: "Kransky Cheese",
  location_id: 1,
  qu_id_stock: 2, // grams
  min_stock_amount: 300,
  default_best_before_days: 7
})

// Shredded Ham - $4.70 per 300g (twin pack)
grocy_product_create({
  name: "Shredded Ham",
  location_id: 1,
  qu_id_stock: 2, // grams
  min_stock_amount: 300,
  default_best_before_days: 14
})
```

### Dairy & Eggs (Location: Refrigerator, Default: 7-30 days)

```javascript
// Liddells Lactose Free Shredded Cheese - $6.50 per 225g
grocy_product_create({
  name: "Lactose Free Shredded Cheese",
  location_id: 1,
  qu_id_stock: 2, // grams
  min_stock_amount: 225,
  default_best_before_days: 30
})

// Extra Large Free Range Eggs - 12 pack (700g)
grocy_product_create({
  name: "Extra Large Free Range Eggs",
  location_id: 1,
  qu_id_stock: 1, // piece (pack of 12)
  min_stock_amount: 1,
  default_best_before_days: 21
})
```

### Freezer (Location: Freezer, Default: 90-365 days)

```javascript
// McCain Mixed Vegetables - $3.60 per 500g
grocy_product_create({
  name: "Mixed Vegetables (Peas, Corn, Carrot)",
  location_id: 3,
  qu_id_stock: 2, // grams
  min_stock_amount: 500,
  default_best_before_days: 365
})

// Woolworths Carrots Peas & Corn - $5.00 per kg
grocy_product_create({
  name: "Frozen Carrots Peas & Corn",
  location_id: 3,
  qu_id_stock: 3, // kg
  min_stock_amount: 1000,
  default_best_before_days: 365
})

// Potato Minis - $5.80 per kg
grocy_product_create({
  name: "Potato Minis",
  location_id: 3,
  qu_id_stock: 3, // kg
  min_stock_amount: 1000,
  default_best_before_days: 365
})

// Broccoli Florets - $4.00 per 500g
grocy_product_create({
  name: "Frozen Broccoli Florets",
  location_id: 3,
  qu_id_stock: 2, // grams
  min_stock_amount: 500,
  default_best_before_days: 365
})

// Crumbed Fish - $11.00 per kg
grocy_product_create({
  name: "Frozen Crumbed Fish",
  location_id: 3,
  qu_id_stock: 3, // kg
  min_stock_amount: 1000,
  default_best_before_days: 365
})

// Frozen Mash Potato - 1kg
grocy_product_create({
  name: "Frozen Mash Potato",
  location_id: 3,
  qu_id_stock: 3, // kg
  min_stock_amount: 1000,
  default_best_before_days: 365
})

// Chicken Breast Tenders - $5.50 per 400g
grocy_product_create({
  name: "Frozen Chicken Breast Tenders",
  location_id: 3,
  qu_id_stock: 2, // grams
  min_stock_amount: 400,
  default_best_before_days: 365
})

// Woolworths Peas - 500g
grocy_product_create({
  name: "Frozen Peas",
  location_id: 3,
  qu_id_stock: 2, // grams
  min_stock_amount: 500,
  default_best_before_days: 365
})
```

### Pantry (Location: Pantry, Default: 365+ days)

```javascript
// Leggo's Bolognese Sauce - $4.60 per 500g
grocy_product_create({
  name: "Bolognese Pasta Sauce",
  location_id: 2,
  qu_id_stock: 2, // grams
  min_stock_amount: 500,
  default_best_before_days: 730
})

// Annalisa Lentils - $1.90 per 400g
grocy_product_create({
  name: "Canned Lentils",
  location_id: 2,
  qu_id_stock: 2, // grams
  min_stock_amount: 400,
  default_best_before_days: 730
})

// Italian Tomatoes - $1.30 per 400g
grocy_product_create({
  name: "Italian Tomatoes with Herbs",
  location_id: 2,
  qu_id_stock: 2, // grams
  min_stock_amount: 400,
  default_best_before_days: 730
})

// Diced Italian Tomatoes - $1.10 per 400g
grocy_product_create({
  name: "Diced Italian Tomatoes",
  location_id: 2,
  qu_id_stock: 2, // grams
  min_stock_amount: 400,
  default_best_before_days: 730
})

// Zafarelli Spaghetti - $1.60 per 500g
// Nutrition per 100g (dry): 371 cal, 13g protein, 75g carbs, 3.2g fiber
grocy_product_create({
  name: "Spaghetti Pasta",
  location_id: 2,
  qu_id_stock: 2, // grams
  qu_id_purchase: 2,
  min_stock_amount: 500,
  default_best_before_days: 730,
  product_group_id: 5, // Pantry
  calories: 371
})
grocy_userfield_set({
  entity: "products",
  object_id: 29,
  userfields: {
    protein_g: 13.0,
    carbs_g: 75.0,
    fiber_g: 3.2,
    fat_g: 1.5,
    sugar_g: 2.7,
    serving_size: "100g (dry)",
    package_size: "500g",
    brand: "Zafarelli"
  }
})

// Woolworths Macaroni - 500g
grocy_product_create({
  name: "Macaroni Pasta",
  location_id: 2,
  qu_id_stock: 2, // grams
  min_stock_amount: 500,
  default_best_before_days: 730
})

// Woolworths Pasta Spirals - $1.00 per 500g
grocy_product_create({
  name: "Pasta Spirals",
  location_id: 2,
  qu_id_stock: 2, // grams
  min_stock_amount: 500,
  default_best_before_days: 730
})

// Bacon Bolognese Sauce - $4.60 per 500g
grocy_product_create({
  name: "Bacon Bolognese Sauce",
  location_id: 2,
  qu_id_stock: 2, // grams
  min_stock_amount: 500,
  default_best_before_days: 730
})

// Beef Liquid Stock - $1.90 per L
grocy_product_create({
  name: "Beef Stock",
  location_id: 2,
  qu_id_stock: 5, // ml
  min_stock_amount: 1000,
  default_best_before_days: 730
})

// Sweet Corn Kernels - $1.20 per 420g
grocy_product_create({
  name: "Corn Kernels",
  location_id: 2,
  qu_id_stock: 2, // grams
  min_stock_amount: 420,
  default_best_before_days: 730
})

// Tuna Chunks - $3.30 per 425g
grocy_product_create({
  name: "Tuna Chunks in Spring Water",
  location_id: 2,
  qu_id_stock: 2, // grams
  min_stock_amount: 425,
  default_best_before_days: 730
})

// Cream of Celery Soup - $1.95 per 410g
grocy_product_create({
  name: "Cream of Celery Soup",
  location_id: 2,
  qu_id_stock: 2, // grams
  min_stock_amount: 410,
  default_best_before_days: 730
})

// Pineapple in Juice - $2.20 per 4 pack (500g)
grocy_product_create({
  name: "Pineapple in Juice",
  location_id: 2,
  qu_id_stock: 2, // grams
  min_stock_amount: 500,
  default_best_before_days: 730
})

// Pizza Sauce - $2.50 per 415g
grocy_product_create({
  name: "Pizza Sauce",
  location_id: 2,
  qu_id_stock: 2, // grams
  min_stock_amount: 415,
  default_best_before_days: 730
})

// Kewpie Mayonnaise - $5.50 per 300g
grocy_product_create({
  name: "Kewpie Japanese Mayonnaise",
  location_id: 2,
  qu_id_stock: 2, // grams
  min_stock_amount: 300,
  default_best_before_days: 365
})

// Roasted Seaweed - $5.50 per 8 pack (40g)
grocy_product_create({
  name: "Roasted Seaweed",
  location_id: 2,
  qu_id_stock: 2, // grams
  min_stock_amount: 40,
  default_best_before_days: 365
})

// Sushi Rice - $4.70 per kg
grocy_product_create({
  name: "Sushi Rice",
  location_id: 2,
  qu_id_stock: 3, // kg
  min_stock_amount: 1000,
  default_best_before_days: 730
})
```

### Bakery (Location: Pantry, Default: 7-14 days)

```javascript
// English Muffins - $3.00 per 6 pack
grocy_product_create({
  name: "English Muffins",
  location_id: 2,
  qu_id_stock: 1, // piece (pack of 6)
  min_stock_amount: 1,
  default_best_before_days: 7
})

// Hotdog Rolls - $3.00 per 6 pack
grocy_product_create({
  name: "Hotdog Rolls",
  location_id: 2,
  qu_id_stock: 1, // piece (pack of 6)
  min_stock_amount: 1,
  default_best_before_days: 7
})

// Mission Wraps - $5.50 per 8 pack (567g)
grocy_product_create({
  name: "Spinach & Herb Wraps",
  location_id: 2,
  qu_id_stock: 1, // piece (pack of 8)
  min_stock_amount: 1,
  default_best_before_days: 14
})
```

---

## 📖 Recipe Creation

### Recipe 1: Spaghetti Bolognese

```javascript
// Step 1: Create the recipe
grocy_recipe_create({
  name: "Spaghetti Bolognese",
  description: "Classic spaghetti with meat sauce, vegetables, and lentils. Cook mince with onion, add mixed vegetables, lentils, tomatoes, and bolognese sauce. Serve over cooked spaghetti.",
  base_servings: 4,
  desired_servings: 4
})
// → Returns recipe_id: X

// Step 2: Add ingredients (use product_ids from creation above)
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Brown Onion ID], amount: 1 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Pork & Beef Mince ID], amount: 500 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Mixed Vegetables ID], amount: 500 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Bolognese Sauce ID], amount: 1000 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Canned Lentils ID], amount: 400 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Italian Tomatoes ID], amount: 400 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Spaghetti Pasta ID], amount: 1000 })
```

### Recipe 2: Fish and Vegetables

```javascript
grocy_recipe_create({
  name: "Fish and Vegetables",
  description: "Crumbed fish with mashed potatoes and steamed broccoli. Bake fish according to package, prepare mash, steam broccoli.",
  base_servings: 4,
  desired_servings: 4
})

grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Lower Carb Potatoes ID], amount: 1500 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Potato Minis ID], amount: 1000 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Frozen Broccoli ID], amount: 1000 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Crumbed Fish ID], amount: 1000 })
```

### Recipe 3: Mac and Cheese

```javascript
grocy_recipe_create({
  name: "Mac and Cheese",
  description: "Creamy macaroni and cheese with vegetables. Cook macaroni, sauté onion, add cheese sauce, mix with carrots/peas/corn.",
  base_servings: 4,
  desired_servings: 4
})

grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Brown Onion ID], amount: 1 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Lactose Free Cheese ID], amount: 225 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Frozen Carrots Peas Corn ID], amount: 1000 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Macaroni Pasta ID], amount: 500 })
```

### Recipe 4: Beef Stew ⭐

```javascript
grocy_recipe_create({
  name: "Beef Stew",
  description: "Hearty beef stew with vegetables and lentils. Brown chuck steak, sauté celery/leek/onion, add potatoes/carrots, beef stock, tomatoes, and lentils. Simmer until tender.",
  base_servings: 6,
  desired_servings: 6
})

grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Celery Sticks ID], amount: 300 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Leek ID], amount: 1 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [White Potato ID], amount: 2 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Carrots ID], amount: 1000 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Beef Chuck Steak ID], amount: 800 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Canned Lentils ID], amount: 400 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Beef Stock ID], amount: 1000 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Diced Tomatoes ID], amount: 400 })
```

### Recipe 5: Pasta Bake ⭐

```javascript
grocy_recipe_create({
  name: "Pasta Bake",
  description: "Baked pasta with bacon, vegetables, and cheese. Cook pasta spirals, fry bacon with onion and capsicum, mix with sauce and tomatoes, top with cheese and bake.",
  base_servings: 4,
  desired_servings: 4
})

grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Brown Onion ID], amount: 1 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Green Capsicum ID], amount: 1 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Middle Bacon ID], amount: 360 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Bacon Bolognese Sauce ID], amount: 500 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Pasta Spirals ID], amount: 500 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Diced Tomatoes ID], amount: 400 })
```

### Recipe 6: Tuna Casserole ⭐

```javascript
grocy_recipe_create({
  name: "Tuna Casserole",
  description: "Creamy tuna and corn casserole. Mix tuna, corn, cream of celery soup with sautéed onion. Top with cheese and mashed potato, bake until golden.",
  base_servings: 4,
  desired_servings: 4
})

grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Brown Onion ID], amount: 1 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Lactose Free Cheese ID], amount: 225 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Frozen Mash ID], amount: 1000 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Corn Kernels ID], amount: 420 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Tuna Chunks ID], amount: 425 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Cream of Celery Soup ID], amount: 410 })
```

### Recipe 7: Mini Pizzas 🍕

```javascript
grocy_recipe_create({
  name: "Mini Pizzas",
  description: "English muffin pizzas with toppings. Split and toast muffins, spread pizza sauce, top with ham, salami, capsicum, pineapple, and cheese. Bake until cheese melts.",
  base_servings: 4,
  desired_servings: 4
})

grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Green Capsicum ID], amount: 1 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Hungarian Salami ID], amount: 100 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Lactose Free Cheese ID], amount: 225 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [English Muffins ID], amount: 2 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Pineapple ID], amount: 500 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Pizza Sauce ID], amount: 415 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Shredded Ham ID], amount: 300 })
```

### Recipe 8: Sushi ⭐

```javascript
grocy_recipe_create({
  name: "Homemade Sushi",
  description: "Sushi rolls with chicken tenders and cucumber. Cook sushi rice, prepare chicken tenders, slice cucumber. Roll with seaweed sheets, serve with mayo.",
  base_servings: 4,
  desired_servings: 4
})

grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Continental Cucumber ID], amount: 2 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Frozen Chicken Tenders ID], amount: 800 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Kewpie Mayo ID], amount: 300 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Roasted Seaweed ID], amount: 40 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Sushi Rice ID], amount: 1000 })
```

### Recipe 9: Fried Rice ⭐

```javascript
grocy_recipe_create({
  name: "Fried Rice",
  description: "Quick fried rice with ham and vegetables. Cook rice ahead, fry ham and spring onion, add rice, peas, and scrambled eggs. Season with soy sauce.",
  base_servings: 4,
  desired_servings: 4
})

grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Spring Onion ID], amount: 1 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Ham Steaks ID], amount: 300 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Extra Large Eggs ID], amount: 1 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Frozen Peas ID], amount: 500 })
```

### Recipe 10: Hotdogs 🌭

```javascript
grocy_recipe_create({
  name: "Gourmet Hotdogs",
  description: "Hotdogs and kransky with cheese and toppings. Grill frankfurts and kransky, toast rolls, add cheese and your favorite toppings.",
  base_servings: 4,
  desired_servings: 4
})

grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Frankfurts ID], amount: 500 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Kransky Cheese ID], amount: 300 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Lactose Free Cheese ID], amount: 225 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Hotdog Rolls ID], amount: 2 })
```

### Recipe 11: Chicken Wraps ⭐

```javascript
grocy_recipe_create({
  name: "Chicken Wraps",
  description: "Crispy chicken tenders wrapped with salad. Cook chicken tenders, warm wraps, fill with salad, cucumber, and chicken. Add your favorite sauce.",
  base_servings: 4,
  desired_servings: 4
})

grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Mixed Leaf Salad ID], amount: 200 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Continental Cucumber ID], amount: 1 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Spinach Wraps ID], amount: 1 })
grocy_recipe_add_ingredient({ recipe_id: X, product_id: [Frozen Chicken Tenders ID], amount: 800 })
```

---

## 🧪 Testing Workflow

### Test 1: Product Groups

```javascript
grocy_product_group_list()
// Should show: Produce, Meat & Seafood, Dairy & Eggs, Freezer, Pantry, Bakery
```

### Test 2: Shopping Locations

```javascript
grocy_store_list()
// Should show: Woolworths, Coles
```

### Test 3: Recipe Fulfillment

```javascript
// Check if you have ingredients for beef stew
grocy_recipe_get_fulfillment({ recipe_id: [Beef Stew ID] })
```

### Test 4: Generate Shopping List

```javascript
// Add missing ingredients to shopping list
grocy_recipe_add_missing_to_shoppinglist({ recipe_id: [Beef Stew ID] })
```

### Test 5: Meal Planning

```javascript
// Plan beef stew for tomorrow
grocy_meal_plan_add({
  recipe_id: [Beef Stew ID],
  date: "2025-11-09",
  section: "dinner",
  servings: 6,
  note: "Family favorite!"
})
```

---

## 📚 Next Steps

1. ✅ **Restart Claude Desktop** to load new tools
2. ✅ Create product groups and stores
3. ✅ Create all products (~45 items)
4. ✅ Create 11 recipes with ingredients
5. ✅ Test PDF receipt parser
6. ✅ Test meal planning workflow
7. ✅ Create BookStack documentation

---

## 🎯 Success Criteria

- [ ] All 6 product groups created
- [ ] Both stores (Woolworths, Coles) created
- [ ] All ~45 products created and categorized
- [ ] All 11 recipes created with ingredients
- [ ] At least 1 PDF receipt successfully parsed
- [ ] Test meal plan created for next week
- [ ] Shopping list generated automatically
- [ ] All documentation published to BookStack

---

**Status**: Ready for execution after MCP server restart
**Estimated Time**: 2-3 hours for full setup
**Documentation**: Will be created in BookStack as we progress
