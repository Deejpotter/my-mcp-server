# Grocy Data Structure Reference

Complete reference for Grocy's data model, entity relationships, and data flow.

---

## 📊 Core Entities Overview

Grocy uses a relational SQLite database with the following main entities:

| Entity | Purpose | Key Relationships |
|--------|---------|------------------|
| **products** | Core product definitions | → locations, quantity_units, product_groups |
| **stock** | Current inventory levels | → products, locations |
| **stock_log** | Transaction history | → products, locations, shopping_locations |
| **recipes** | Meal definitions | → products (via recipe_pos) |
| **recipe_pos** | Recipe ingredients | → recipes, products, quantity_units |
| **meal_plan** | Planned meals | → recipes |
| **shopping_list** | Items to purchase | → products, shopping_locations |
| **locations** | Storage locations | ← products, stock |
| **shopping_locations** | Stores/shops | ← stock_log, shopping_list |
| **quantity_units** | Measurement units | ← products |
| **product_groups** | Product categories | ← products |

---

## 🗂️ Entity Schemas

### 1. Products (`products`)

**Purpose**: Core product definitions with default settings

```typescript
interface GrocyProduct {
  id: number;                        // Primary key
  name: string;                      // Display name
  description?: string;              // Optional description
  
  // Foreign Keys
  location_id?: number;              // FK → locations.id (default storage)
  qu_id_stock: number;               // FK → quantity_units.id (stock unit)
  qu_id_purchase: number;            // FK → quantity_units.id (purchase unit)
  product_group_id?: number;         // FK → product_groups.id (category)
  
  // Settings
  min_stock_amount: number;          // Minimum stock level
  default_best_before_days: number;  // Default expiry days (0 = no tracking)
  picture_file_name?: string;        // Product image
  barcode?: string;                  // Barcode for scanning
  
  // ✨ Built-in Nutrition (v4.0+)
  calories?: number;                 // Calories per stock quantity unit (auto-summed in recipes)
  
  // 🔧 Userfields (Custom Fields) - See Userfields section below
  // Products can have any custom fields defined via Grocy's userfield system
  // Common userfields: protein_g, carbs_g, fat_g, fiber_g, brand, package_size
}
```

**API Tools**:

- `grocy_product_create` - Create new product (with calories)
- `grocy_userfield_get` - Get custom userfields for product (planned)
- `grocy_userfield_set` - Set custom userfields for product (planned)

**Related Entities**:

- Parent: `locations`, `quantity_units`, `product_groups`
- Child: `stock`, `stock_log`, `recipe_pos`, `shopping_list`
- Custom: `userfields` (for nutrition, brand, etc.)

---

### 2. Stock (`stock`)

**Purpose**: Current inventory levels and status

```typescript
interface GrocyStockResponse {
  product_id: number;                // FK → products.id
  amount: string;                    // Current amount (as string)
  amount_aggregated: string;         // Total across all locations
  amount_opened: string;             // Opened amount
  amount_opened_aggregated: string;  // Total opened
  best_before_date: string;          // Next expiry date
  is_aggregated_amount?: boolean;    // Aggregation flag
  product?: GrocyProduct;            // Nested product details
}

interface GrocyProductDetails {
  product: GrocyProduct;             // Base product
  last_purchased?: string;           // Last purchase date
  last_used?: string;                // Last consumption date
  stock_amount: number;              // Current stock
  stock_amount_opened: number;       // Opened stock
  next_best_before_date?: string;    // Next expiry
  last_price?: number;               // Most recent price
  avg_price?: number;                // Average price
  location?: {                       // Current location
    id: number;
    name: string;
  };
}
```

**API Tools**:

- `grocy_stock_get_current` - All products in stock
- `grocy_stock_get_product` - Single product details
- `grocy_stock_get_product_by_barcode` - Lookup by barcode
- `grocy_stock_get_volatile` - Expiring/missing products
- `grocy_stock_add_product` - Add to stock (purchase)
- `grocy_stock_consume_product` - Remove from stock (use)

**Related Entities**:

- Parent: `products`, `locations`
- Child: `stock_log`

---

### 3. Stock Log (`stock_log`)

**Purpose**: Complete transaction journal for all stock movements

```typescript
interface GrocyStockLogEntry {
  id: number;                        // Primary key
  product_id: number;                // FK → products.id
  amount: string;                    // Transaction amount
  best_before_date: string;          // Expiry date
  purchased_date: string;            // Purchase date
  transaction_type: string;          // "purchase" | "consume" | "transfer" | "inventory-correction" | "product-opened"
  price?: number;                    // Price per unit
  location_id?: number;              // FK → locations.id
  shopping_location_id?: number;     // FK → shopping_locations.id
  note?: string;                     // Transaction note
  spoiled?: boolean;                 // Spoilage flag
  stock_id?: string;                 // Stock entry reference
  transaction_id?: string;           // Transaction group ID
  undone?: boolean;                  // Undo flag
  undone_timestamp?: string;         // Undo time
  user_id?: number;                  // User who made transaction
  recipe_id?: number;                // FK → recipes.id (if consumed for recipe)
}
```

**API Endpoints** (not exposed as tools yet):

- `GET /objects/stock_log` - Full transaction history
- `GET /stock/products/{id}/entries` - Product transaction history
- `GET /stock/products/{id}/price-history` - Price history

**Data Analytics Use**:

- Price tracking over time
- Purchase patterns
- Consumption rates
- Spoilage analysis
- Store price comparison

**Related Entities**:

- Parent: `products`, `locations`, `shopping_locations`, `recipes`

---

### 4. Recipes (`recipes`)

**Purpose**: Meal definitions with ingredient lists

```typescript
interface GrocyRecipe {
  id: number;                        // Primary key
  name: string;                      // Recipe name
  description?: string;              // Instructions/notes
  base_servings: number;             // Default servings
  desired_servings: number;          // Target servings
  picture_file_name?: string;        // Recipe image
  type: string;                      // Recipe type/category
}

interface GrocyRecipeFulfillment {
  need_fulfilled: boolean;                      // Can make now?
  need_fulfilled_with_shopping_list: boolean;   // Can make after shopping?
  missing_products: Array<{
    id: number;                                 // Product ID
    amount_missing: number;                     // Stock shortage
    amount_missing_for_recipe: number;          // Recipe needs
  }>;
}
```

**API Tools**:

- `grocy_recipe_create` - Create new recipe
- `grocy_recipe_add_ingredient` - Add ingredient to recipe
- `grocy_recipe_get_fulfillment` - Check ingredient availability
- `grocy_recipe_consume` - Use ingredients from stock
- `grocy_recipe_add_missing_to_shoppinglist` - Add missing to list

**Related Entities**:

- Child: `recipe_pos` (ingredients)
- Referenced by: `meal_plan`, `stock_log`

---

### 5. Recipe Ingredients (`recipe_pos`)

**Purpose**: Maps products to recipes with quantities

```typescript
interface GrocyRecipeIngredient {
  id: number;                        // Primary key
  recipe_id: number;                 // FK → recipes.id
  product_id: number;                // FK → products.id
  amount: number;                    // Quantity needed
  qu_id?: number;                    // FK → quantity_units.id (defaults to product's stock unit)
  note?: string;                     // Ingredient note (e.g., "lean beef", "fresh")
  only_check_single_unit_in_stock?: boolean;
}
```

**API Integration**:

- Created via `grocy_recipe_add_ingredient`
- Used by `grocy_recipe_get_fulfillment` to check stock

**Related Entities**:

- Parent: `recipes`, `products`, `quantity_units`

---

### 6. Meal Plan (`meal_plan`)

**Purpose**: Scheduled recipes for specific dates

```typescript
interface GrocyMealPlan {
  id: number;                        // Primary key
  recipe_id: number;                 // FK → recipes.id
  day: string;                       // Date (YYYY-MM-DD)
  type: string;                      // Section: "breakfast" | "lunch" | "dinner"
  note?: string;                     // Meal note
  product_id?: number;               // FK → products.id (alternative to recipe)
  product_amount?: number;           // Product quantity
  product_qu_id?: number;            // FK → quantity_units.id
  done?: boolean;                    // Completion flag
  servings?: number;                 // Serving override
}
```

**API Tools**:

- `grocy_meal_plan_add` - Schedule a recipe
- `grocy_meal_plan_get` - Get plans for date range
- `grocy_meal_plan_delete` - Remove meal plan entry

**Use Cases**:

- Weekly meal planning
- Automatic shopping list generation
- Recipe rotation tracking
- Family calendar integration

**Related Entities**:

- Parent: `recipes`, `products`

---

### 7. Shopping List (`shopping_list`)

**Purpose**: Items needed for purchase

```typescript
interface GrocyShoppingListItem {
  id: number;                        // Primary key
  product_id?: number;               // FK → products.id
  note?: string;                     // Item note/description
  amount: number;                    // Quantity to buy
  shopping_list_id: number;          // List ID (default: 1)
  done: boolean;                     // Purchased flag
  qu_id?: number;                    // FK → quantity_units.id
  row_created_timestamp?: string;    // Creation time
}
```

**API Tools**:

- `grocy_shoppinglist_add_product` - Add item
- `grocy_shoppinglist_remove_product` - Remove/reduce item
- `grocy_shoppinglist_add_missing` - Auto-add below min stock
- `grocy_shoppinglist_clear` - Clear list

**Generation Methods**:

1. Manual addition
2. Below minimum stock (`grocy_shoppinglist_add_missing`)
3. Recipe missing ingredients (`grocy_recipe_add_missing_to_shoppinglist`)

**Related Entities**:

- Parent: `products`, `shopping_locations`

---

### 8. Locations (`locations`)

**Purpose**: Storage locations (fridge, pantry, freezer, etc.)

```typescript
interface GrocyLocation {
  id: number;                        // Primary key
  name: string;                      // Location name
  description?: string;              // Location description
  is_freezer?: boolean;              // Freezer flag (affects expiry)
}
```

**API Tools**:

- `grocy_location_list` - List all locations

**Related Entities**:

- Referenced by: `products` (default location), `stock`, `stock_log`

---

### 9. Shopping Locations (`shopping_locations`)

**Purpose**: Stores/shops where products are purchased

```typescript
interface GrocyShoppingLocation {
  id: number;                        // Primary key
  name: string;                      // Store name (e.g., "Woolworths", "Coles")
  description?: string;              // Store description
}
```

**API Tools**:

- `grocy_store_create` - Create store
- `grocy_store_list` - List all stores

**Use Cases**:

- Price comparison across stores
- Store-specific shopping lists
- Receipt tracking (which store purchased from)

**Related Entities**:

- Referenced by: `stock_log`, `shopping_list`

---

### 10. Quantity Units (`quantity_units`)

**Purpose**: Measurement units (kg, g, L, ml, piece, pack, etc.)

```typescript
interface GrocyQuantityUnit {
  id: number;                        // Primary key
  name: string;                      // Unit name (e.g., "kg")
  name_plural?: string;              // Plural form (e.g., "kilograms")
  description?: string;              // Unit description
  plural_forms?: string;             // JSON plural rules
}
```

**API Tools**:

- `grocy_quantity_unit_list` - List all units

**Common Units**:

- 1: piece/item
- 2: gram (g)
- 3: kilogram (kg)
- 4: liter (L)
- 5: milliliter (ml)
- 6: pack/package

**Related Entities**:

- Referenced by: `products` (stock unit, purchase unit), `recipe_pos`, `meal_plan`

---

### 11. Product Groups (`product_groups`)

**Purpose**: Product categories for organization

```typescript
interface GrocyProductGroup {
  id: number;                        // Primary key
  name: string;                      // Group name (e.g., "Produce", "Dairy", "Meat")
  description?: string;              // Group description
}
```

**API Tools**:

- `grocy_product_group_create` - Create group
- `grocy_product_group_list` - List all groups

**Common Groups**:

- Produce (fruits, vegetables)
- Dairy (milk, cheese, yogurt)
- Meat (beef, chicken, pork, fish)
- Pantry Staples (pasta, rice, flour)
- Bakery (bread, buns)
- Frozen Foods

**Related Entities**:

- Referenced by: `products`

---

### 12. Volatile Stock Analysis

**Purpose**: Special view for expiring and missing products

```typescript
interface GrocyVolatileStock {
  due_products: GrocyStockResponse[];       // Expiring soon (within threshold)
  overdue_products: GrocyStockResponse[];   // Past best before date
  expired_products: GrocyStockResponse[];   // Expired products
  missing_products: Array<{                 // Below min stock
    id: number;
    name: string;
    amount_missing: number;
    is_partly_in_stock: boolean;
  }>;
}
```

**API Tools**:

- `grocy_stock_get_volatile` - Get all volatile stock

**Use Cases**:

- Food waste prevention
- Automatic restocking
- Meal planning prioritization
- Shopping list generation

---

### 13. Userfields (Custom Fields) 🔧

**Purpose**: Attach custom fields to ANY entity (products, recipes, locations, etc.)

**Key Features**:

- Available since Grocy v2.6.0 (April 2019)
- Can be attached to products, recipes, locations, equipment, chores, etc.
- Field types: text, number, datetime, checkbox, link, preset list
- Can show as columns in tables
- Filter/search by userfield values
- API endpoints for get/set

**API Endpoints** (not yet in MCP tools):

```
GET  /userfields/{entity}/{objectId}  - Get userfields for an object
PUT  /userfields/{entity}/{objectId}  - Set userfields for an object
GET  /userfields/{entity}             - Get userfield definitions for entity
```

**Common Userfields for Products**:

```typescript
// Nutrition information (per 100g or per serving)
{
  protein_g: 20.5,              // Protein in grams
  carbs_g: 0.5,                 // Carbohydrates in grams
  fat_g: 15.2,                  // Fat in grams
  fiber_g: 0,                   // Fiber in grams
  sugar_g: 0.3,                 // Sugar in grams
  sodium_mg: 75,                // Sodium in milligrams
  saturated_fat_g: 7.8,         // Saturated fat in grams
}

// Product metadata
{
  brand: "Woolworths",          // Brand name
  package_size: "500g",         // Package size
  serving_size: "100g",         // Serving size
  servings_per_package: 5,      // Number of servings
  country_of_origin: "Australia",
  is_organic: true,             // Boolean
  is_gluten_free: false,
  is_lactose_free: true,
}
```

**Common Userfields for Recipes**:

```typescript
{
  prep_time_minutes: 15,        // Preparation time
  cook_time_minutes: 30,        // Cooking time
  total_time_minutes: 45,       // Total time
  difficulty: "medium",         // easy | medium | hard
  cuisine_type: "Italian",      // Italian, Asian, Mexican, etc.
  meal_type: "dinner",          // breakfast, lunch, dinner, snack
  season: "all-year",           // summer, winter, fall, spring, all-year
  is_vegetarian: false,         // Boolean
  is_kid_friendly: true,        // Boolean
  is_freezer_friendly: true,    // Boolean
  skill_level: "intermediate",  // beginner, intermediate, advanced
}
```

**⚠️ Current Limitation**:

- Userfields are NOT automatically aggregated at recipe/meal plan level
- Must calculate nutrition totals manually from ingredients
- Tracked in [Grocy issue #413](https://github.com/grocy/grocy/issues/413)

**Workaround for Nutrition Tracking**:

1. Use built-in `calories` field (auto-summed in recipes)
2. Store nutrition userfields per product
3. Manually calculate recipe totals when needed
4. Or create MCP helper tools to sum nutrition from ingredients

---

## 🔗 Entity Relationship Diagram

```
┌─────────────────┐
│ product_groups  │
└────────┬────────┘
         │
         │ 1:N
         ↓
┌─────────────────┐     1:N      ┌──────────────┐
│ quantity_units  │←──────────────┤  products    │
└─────────────────┘               └──────┬───────┘
         ↑                               │
         │ 1:N                           │ 1:N
         │                               ↓
┌─────────────────┐               ┌──────────────┐
│   locations     │──────────────→│    stock     │
└─────────────────┘     1:N       └──────┬───────┘
         ↑                               │
         │                               │ 1:N
         │ 1:N                           ↓
         │                         ┌──────────────┐
┌─────────────────┐                │  stock_log   │
│ shop_locations  │───────────────→│  (journal)   │
└─────────────────┘     1:N        └──────────────┘
         ↑
         │ 1:N
         │
┌─────────────────┐
│ shopping_list   │
└─────────────────┘

┌─────────────────┐     1:N      ┌──────────────┐
│    recipes      │←──────────────┤  recipe_pos  │
└────────┬────────┘               │ (ingredients)│
         │                        └──────┬───────┘
         │ 1:N                           │
         ↓                               │ N:1
┌─────────────────┐                      ↓
│   meal_plan     │               ┌──────────────┐
└─────────────────┘               │  products    │
                                  └──────────────┘
```

---

## 📈 Data Flow Patterns

### 1. Receipt Processing → Stock

```
PDF Receipt (Woolworths/Coles)
    ↓ [pdf_extract_receipt]
Structured Data (items, prices, date)
    ↓ [For each item]
Product Lookup/Create
    ↓ [grocy_stock_add_product]
Stock Entry + Stock Log
    ↓ [Grocy calculates]
Updated Stock Levels + Price History
```

### 2. Meal Planning → Shopping List

```
User selects recipes
    ↓ [grocy_meal_plan_add]
Meal Plan Entries (dates + recipes)
    ↓ [grocy_recipe_get_fulfillment]
Check Ingredient Availability
    ↓ [If missing ingredients]
Shopping List Generation
    ↓ [grocy_recipe_add_missing_to_shoppinglist]
Shopping List Items
```

### 3. Stock Consumption → Analytics

```
Meal Preparation
    ↓ [grocy_recipe_consume]
Stock Reduction
    ↓ [Grocy logs]
Stock Log Entries (transaction_type: "consume")
    ↓ [Analytics query]
Consumption Patterns + Usage Statistics
```

### 4. Price Tracking

```
Purchase (grocy_stock_add_product with price)
    ↓
Stock Log Entry (with price, shopping_location_id)
    ↓ [GET /stock/products/{id}/price-history]
Price History by Store
    ↓ [Analytics]
Best Price Analysis + Store Comparison
```

---

## 🛠️ API Endpoints (Not Yet Exposed)

These Grocy API endpoints exist but don't have MCP tools yet:

### Analytics Endpoints

- `GET /stock/products/{id}/entries` - Product transaction history
- `GET /stock/products/{id}/price-history` - Price history
- `GET /objects/stock_log` - Full transaction journal
- `GET /stock/bookings` - Stock bookings/reservations

### System Endpoints

- `GET /system/info` - System information
- `GET /objects/{entity}` - Generic entity query
- `GET /userfields` - Custom field definitions
- `GET /tasks` - Task management

---

## 📝 Data Connections Summary

| From | To | Relationship | Via |
|------|-----|-------------|-----|
| products | locations | N:1 | location_id |
| products | quantity_units | N:1 | qu_id_stock, qu_id_purchase |
| products | product_groups | N:1 | product_group_id |
| stock | products | N:1 | product_id |
| stock | locations | N:1 | location_id |
| stock_log | products | N:1 | product_id |
| stock_log | locations | N:1 | location_id |
| stock_log | shopping_locations | N:1 | shopping_location_id |
| stock_log | recipes | N:1 | recipe_id (optional) |
| recipe_pos | recipes | N:1 | recipe_id |
| recipe_pos | products | N:1 | product_id |
| recipe_pos | quantity_units | N:1 | qu_id |
| meal_plan | recipes | N:1 | recipe_id |
| meal_plan | products | N:1 | product_id (optional) |
| shopping_list | products | N:1 | product_id |
| shopping_list | shopping_locations | N:1 | shopping_location_id |

---

## 📊 Nutrition Tracking Strategy

### Built-in Support

**Calories Field (Built-in)**:

- `products.calories` - Calories per stock quantity unit
- Automatically aggregated at recipe level
- Shows total calories for recipe based on ingredient amounts
- Does NOT auto-aggregate at meal plan level yet

### Enhanced Nutrition via Userfields

**Recommended Approach**:

1. **Add nutrition userfields to products** (per 100g or per serving)
   - protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg

2. **Track at product level** (via userfields API)

3. **Calculate recipe nutrition** (manual or via helper tool)
   - Sum ingredients × amounts
   - Divide by servings

4. **Store recipe nutrition** (as userfields on recipe)
   - For quick reference
   - Update when ingredients change

**Example: Beef Mince Product**:

```typescript
// Built-in fields
{
  name: "Pork & Beef Mince",
  calories: 254,  // per 100g
}

// Userfields (per 100g)
{
  protein_g: 17.2,
  carbs_g: 0.3,
  fat_g: 20,
  saturated_fat_g: 9,
  fiber_g: 0,
  sugar_g: 0,
  sodium_mg: 75,
  brand: "Woolworths",
  package_size: "500g",
  serving_size: "100g"
}
```

**Example: Recipe Nutrition Calculation**:

```typescript
// Spaghetti Bolognese (4 servings)
// 500g beef mince (250 cal/100g) = 1270 calories
// 500g pasta (350 cal/100g) = 1750 calories
// 500g tomato sauce (60 cal/100g) = 300 calories
// Total: 3320 calories ÷ 4 servings = 830 cal/serving

// Store as recipe userfields:
{
  calories_per_serving: 830,
  protein_g_per_serving: 35,
  carbs_g_per_serving: 95,
  fat_g_per_serving: 28,
}
```

### Future Enhancement: MCP Nutrition Tools

**Planned Tools** (not yet implemented):

- `grocy_nutrition_calculate_recipe` - Calculate from ingredients
- `grocy_nutrition_get_meal_plan` - Nutrition for date range
- `grocy_nutrition_daily_summary` - Daily totals

---

## 💰 Price Tracking Strategy

### Built-in Price Tracking

**Automatic via stock_log**:

- Every `grocy_stock_add_product` with `price` parameter creates entry
- `stock_log.price` - Price per stock quantity unit
- `stock_log.shopping_location_id` - Which store
- `stock_log.purchased_date` - When purchased

**Price History API**:

```
GET /stock/products/{id}/price-history
Returns: [
  { date: "2025-11-05", price: 6.50, shopping_location_id: 1 },
  { date: "2025-10-28", price: 6.20, shopping_location_id: 1 },
  { date: "2025-10-15", price: 6.80, shopping_location_id: 2 }
]
```

**Product Details with Prices**:

```typescript
{
  product: { id: 1, name: "Beef Mince" },
  last_price: 6.50,      // Most recent purchase
  avg_price: 6.50,       // Average of in-stock items
  current_price: 6.50,   // Next item to consume
}
```

### Price Comparison Workflow

1. **Add products to stock with prices**:

   ```typescript
   grocy_stock_add_product({
     product_id: 1,
     amount: 500,
     price: 6.50,  // per stock unit (500g)
     shopping_location_id: 1  // Woolworths
   })
   ```

2. **Track over time** - Each purchase adds to history

3. **Compare stores** - Query price history by shopping_location_id

4. **Identify trends** - Min/max/avg prices, price changes

### Future Enhancement: MCP Price Tools

**Planned Tools** (implemented in analytics phase):

- `grocy_stock_price_history` - Price trends
- `grocy_analytics_price_comparison` - Compare stores
- `grocy_analytics_spending` - Total spending by period/store/category

---

## 🎯 Implementation Roadmap

### Phase 1: Enhanced Documentation ✅

- [x] Document userfields system
- [x] Define nutrition tracking strategy
- [x] Document price tracking approach
- [x] Update GROCY_DATA_STRUCTURE.md

### Phase 2: MCP Tool Enhancements (Current)

- [ ] Add userfields support to `grocy_product_create`
- [ ] Create `grocy_userfield_get` tool
- [ ] Create `grocy_userfield_set` tool
- [ ] Add nutrition calculation helpers

### Phase 3: Recipe Enhancement

- [ ] Add nutrition data to all 11 recipes
- [ ] Add price estimates to all products
- [ ] Update RECIPE_SETUP_GUIDE.md

### Phase 4: Analytics Tools

- [ ] Implement price history tools
- [ ] Implement spending analytics
- [ ] Implement nutrition aggregation tools

---

**Last Updated**: 2025-11-09
**Grocy Version**: v4.x (API compatible)
**MCP Tools**: 28 implemented, 6 planned (userfields + nutrition + price analytics)
