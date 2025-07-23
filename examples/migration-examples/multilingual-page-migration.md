# Multi-language Page Migration Example

This example shows how to migrate a complex multi-language page with internationalization features.

## Before Migration (Legacy Format)

**File:** `src/pages/products.mtm`

```mtm
---
page_title: Product Catalog
page_description: Browse our extensive product catalog
meta_keywords: products, catalog, shop, buy, online store
template: catalog
http_status: 200
route: en:/products, fr:/produits, es:/productos, de:/produkte
---

$products = createSignal([])
$categories = createSignal([])
$selectedCategory = createSignal('all')
$searchQuery = createSignal('')
$sortBy = createSignal('name')
$sortOrder = createSignal('asc')
$loading = createSignal(true)
$error = createSignal(null)
$currentPage = createSignal(1)
$itemsPerPage = createSignal(12)

// Get current locale from URL or browser
$locale = createSignal(detectLocale())
$translations = createSignal({})

$mount = async () => {
  try {
    // Load translations
    const translationsData = await fetch(`/api/translations/${$locale()}`).then(r => r.json())
    $translations = translationsData

    // Load products and categories
    const [productsData, categoriesData] = await Promise.all([
      fetch(`/api/products?locale=${$locale()}`).then(r => r.json()),
      fetch(`/api/categories?locale=${$locale()}`).then(r => r.json())
    ])

    $products = productsData
    $categories = categoriesData
  } catch (err) {
    $error = err.message
  } finally {
    $loading = false
  }
}

function detectLocale() {
  const path = window.location.pathname
  if (path.startsWith('/fr') || path.includes('/produits')) return 'fr'
  if (path.startsWith('/es') || path.includes('/productos')) return 'es'
  if (path.startsWith('/de') || path.includes('/produkte')) return 'de'
  return 'en'
}

$t = (key, params = {}) => {
  let translation = $translations()[key] || key
  Object.keys(params).forEach(param => {
    translation = translation.replace(`{{${param}}}`, params[param])
  })
  return translation
}

$changeLocale = (newLocale) => {
  const routeMap = {
    en: '/products',
    fr: '/produits',
    es: '/productos',
    de: '/produkte'
  }
  window.location.href = routeMap[newLocale]
}

$filteredProducts = () => {
  let filtered = $products()

  // Filter by category
  if ($selectedCategory() !== 'all') {
    filtered = filtered.filter(product => product.category === $selectedCategory())
  }

  // Filter by search query
  if ($searchQuery().trim()) {
    const query = $searchQuery().toLowerCase()
    filtered = filtered.filter(product =>
      product.name.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query)
    )
  }

  // Sort products
  filtered.sort((a, b) => {
    const aVal = a[$sortBy()]
    const bVal = b[$sortBy()]
    const order = $sortOrder() === 'asc' ? 1 : -1

    if (typeof aVal === 'string') {
      return aVal.localeCompare(bVal) * order
    }
    return (aVal - bVal) * order
  })

  return filtered
}

$paginatedProducts = () => {
  const filtered = $filteredProducts()
  const start = ($currentPage() - 1) * $itemsPerPage()
  const end = start + $itemsPerPage()
  return filtered.slice(start, end)
}

$totalPages = () => Math.ceil($filteredProducts().length / $itemsPerPage())

$updateSearch = (query) => {
  $searchQuery = query
  $currentPage = 1 // Reset to first page
}

$updateCategory = (category) => {
  $selectedCategory = category
  $currentPage = 1 // Reset to first page
}

$updateSort = (field, order) => {
  $sortBy = field
  $sortOrder = order
}

$goToPage = (page) => {
  $currentPage = Math.max(1, Math.min(page, $totalPages()))
}

<div class="products-page">
  <header class="page-header">
    <h1>{$t('products.title')}</h1>
    <p class="subtitle">{$t('products.subtitle')}</p>

    <div class="locale-switcher">
      <label>{$t('common.language')}:</label>
      <select onChange={(e) => $changeLocale(e.target.value)} value={$locale()}>
        <option value="en">English</option>
        <option value="fr">Français</option>
        <option value="es">Español</option>
        <option value="de">Deutsch</option>
      </select>
    </div>
  </header>

  {$loading() ? (
    <div class="loading">
      <p>{$t('common.loading')}</p>
    </div>
  ) : $error() ? (
    <div class="error">
      <p>{$t('common.error')}: {$error()}</p>
      <button onClick={() => window.location.reload()}>
        {$t('common.retry')}
      </button>
    </div>
  ) : (
    <main class="catalog-content">
      <aside class="filters">
        <div class="search-filter">
          <label>{$t('products.search')}:</label>
          <input
            type="text"
            placeholder={$t('products.searchPlaceholder')}
            value={$searchQuery()}
            onInput={(e) => $updateSearch(e.target.value)}
            class="search-input"
          />
        </div>

        <div class="category-filter">
          <label>{$t('products.category')}:</label>
          <select
            value={$selectedCategory()}
            onChange={(e) => $updateCategory(e.target.value)}
          >
            <option value="all">{$t('products.allCategories')}</option>
            {$categories().map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div class="sort-filter">
          <label>{$t('products.sortBy')}:</label>
          <select
            value={`${$sortBy()}-${$sortOrder()}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-')
              $updateSort(field, order)
            }}
          >
            <option value="name-asc">{$t('products.nameAsc')}</option>
            <option value="name-desc">{$t('products.nameDesc')}</option>
            <option value="price-asc">{$t('products.priceAsc')}</option>
            <option value="price-desc">{$t('products.priceDesc')}</option>
          </select>
        </div>
      </aside>

      <section class="products-grid">
        <div class="results-info">
          <p>
            {$t('products.showingResults', {
              start: ($currentPage() - 1) * $itemsPerPage() + 1,
              end: Math.min($currentPage() * $itemsPerPage(), $filteredProducts().length),
              total: $filteredProducts().length
            })}
          </p>
        </div>

        <div class="product-cards">
          {$paginatedProducts().map(product => (
            <article key={product.id} class="product-card">
              <div class="product-image">
                <img src={product.image} alt={product.name} />
              </div>
              <div class="product-info">
                <h3 class="product-name">{product.name}</h3>
                <p class="product-description">{product.description}</p>
                <div class="product-price">
                  <span class="price">{product.price} €</span>
                  {product.originalPrice && (
                    <span class="original-price">{product.originalPrice} €</span>
                  )}
                </div>
                <div class="product-actions">
                  <button
                    onClick={() => addToCart(product.id)}
                    class="add-to-cart-btn"
                  >
                    {$t('products.addToCart')}
                  </button>
                  <a href={`/${$locale()}/products/${product.slug}`} class="view-details">
                    {$t('products.viewDetails')}
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        {$totalPages() > 1 && (
          <nav class="pagination">
            <button
              onClick={() => $goToPage($currentPage() - 1)}
              disabled={$currentPage() === 1}
              class="pagination-btn"
            >
              {$t('common.previous')}
            </button>

            {Array.from({length: $totalPages()}, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => $goToPage(page)}
                class={`pagination-btn ${page === $currentPage() ? 'active' : ''}`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => $goToPage($currentPage() + 1)}
              disabled={$currentPage() === $totalPages()}
              class="pagination-btn"
            >
              {$t('common.next')}
            </button>
          </nav>
        )}
      </section>
    </main>
  )}
</div>
```

## Migration Command

```bash
npx mtm-migrate migrate src/pages/products.mtm --verbose
```

## After Migration (Modern Format)

**File:** `src/pages/products.mtm`

```mtm
---
title: Product Catalog
description: Browse our extensive product catalog
keywords: [products, catalog, shop, buy, online, store, ecommerce]
layout: catalog
status: 200
route:
  en: /products
  fr: /produits
  es: /productos
  de: /produkte
locales: [en, fr, es, de]
---

$products! = signal('products', [])
$categories! = signal('categories', [])
$selectedCategory! = signal('selectedCategory', 'all')
$searchQuery! = signal('searchQuery', '')
$sortBy! = signal('sortBy', 'name')
$sortOrder! = signal('sortOrder', 'asc')
$loading! = signal('loading', true)
$error! = signal('error', null)
$currentPage! = signal('currentPage', 1)
$itemsPerPage! = signal('itemsPerPage', 12)

// Get current locale from URL or browser
$locale! = signal('locale', detectLocale())
$translations! = signal('translations', {})

$onMount = async () => {
  try {
    signal.emit('products-page-loading', { locale: $locale })

    // Load translations
    const translationsData = await fetch(`/api/translations/${$locale}`).then(r => r.json())
    $translations = translationsData

    // Load products and categories
    const [productsData, categoriesData] = await Promise.all([
      fetch(`/api/products?locale=${$locale}`).then(r => r.json()),
      fetch(`/api/categories?locale=${$locale}`).then(r => r.json())
    ])

    $products = productsData
    $categories = categoriesData

    signal.emit('products-loaded', {
      productCount: productsData.length,
      categoryCount: categoriesData.length,
      locale: $locale
    })
  } catch (err) {
    $error = err.message
    signal.emit('products-error', { error: err.message, locale: $locale })
  } finally {
    $loading = false
  }
}

function detectLocale() {
  if (typeof window === 'undefined') return 'en' // SSR fallback

  const path = window.location.pathname
  if (path.startsWith('/fr') || path.includes('/produits')) return 'fr'
  if (path.startsWith('/es') || path.includes('/productos')) return 'es'
  if (path.startsWith('/de') || path.includes('/produkte')) return 'de'
  return 'en'
}

$t = (key, params = {}) => {
  let translation = $translations[key] || key
  Object.keys(params).forEach(param => {
    translation = translation.replace(`{{${param}}}`, params[param])
  })
  return translation
}

$changeLocale = (newLocale) => {
  const routeMap = {
    en: '/products',
    fr: '/produits',
    es: '/productos',
    de: '/produkte'
  }

  signal.emit('locale-changed', {
    from: $locale,
    to: newLocale,
    route: routeMap[newLocale]
  })

  window.location.href = routeMap[newLocale]
}

// Computed signals for derived state
$filteredProducts = computed(() => {
  let filtered = $products

  // Filter by category
  if ($selectedCategory !== 'all') {
    filtered = filtered.filter(product => product.category === $selectedCategory)
  }

  // Filter by search query
  if ($searchQuery.trim()) {
    const query = $searchQuery.toLowerCase()
    filtered = filtered.filter(product =>
      product.name.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query)
    )
  }

  // Sort products
  filtered.sort((a, b) => {
    const aVal = a[$sortBy]
    const bVal = b[$sortBy]
    const order = $sortOrder === 'asc' ? 1 : -1

    if (typeof aVal === 'string') {
      return aVal.localeCompare(bVal) * order
    }
    return (aVal - bVal) * order
  })

  return filtered
})

$paginatedProducts = computed(() => {
  const filtered = $filteredProducts
  const start = ($currentPage - 1) * $itemsPerPage
  const end = start + $itemsPerPage
  return filtered.slice(start, end)
})

$totalPages = computed(() => Math.ceil($filteredProducts.length / $itemsPerPage))

$updateSearch = (query) => {
  $searchQuery = query
  $currentPage = 1 // Reset to first page

  signal.emit('search-updated', {
    query,
    resultCount: $filteredProducts.length
  })
}

$updateCategory = (category) => {
  $selectedCategory = category
  $currentPage = 1 // Reset to first page

  signal.emit('category-changed', {
    category,
    resultCount: $filteredProducts.length
  })
}

$updateSort = (field, order) => {
  signal.batch(() => {
    $sortBy = field
    $sortOrder = order
  })

  signal.emit('sort-changed', { field, order })
}

$goToPage = (page) => {
  const newPage = Math.max(1, Math.min(page, $totalPages))
  $currentPage = newPage

  signal.emit('page-changed', {
    page: newPage,
    totalPages: $totalPages
  })
}

$addToCart = (productId) => {
  const product = $products.find(p => p.id === productId)
  signal.emit('product-added-to-cart', {
    product,
    locale: $locale
  })

  // This would typically integrate with a cart system
  console.log('Added to cart:', product)
}

<template>
  <div class="products-page">
    <header class="page-header">
      <h1>{$t('products.title')}</h1>
      <p class="subtitle">{$t('products.subtitle')}</p>

      <div class="locale-switcher">
        <label>{$t('common.language')}:</label>
        <select change={(e) => $changeLocale(e.target.value)} value={$locale}>
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="es">Español</option>
          <option value="de">Deutsch</option>
        </select>
      </div>
    </header>

    {#if $loading}
      <div class="loading">
        <p>{$t('common.loading')}</p>
      </div>
    {:else if $error}
      <div class="error">
        <p>{$t('common.error')}: {$error}</p>
        <button click={() => window.location.reload()}>
          {$t('common.retry')}
        </button>
      </div>
    {:else}
      <main class="catalog-content">
        <aside class="filters">
          <div class="search-filter">
            <label>{$t('products.search')}:</label>
            <input
              type="text"
              placeholder={$t('products.searchPlaceholder')}
              value={$searchQuery}
              input={(e) => $updateSearch(e.target.value)}
              class="search-input"
            />
          </div>

          <div class="category-filter">
            <label>{$t('products.category')}:</label>
            <select
              value={$selectedCategory}
              change={(e) => $updateCategory(e.target.value)}
            >
              <option value="all">{$t('products.allCategories')}</option>
              {#each $categories as category}
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              {/each}
            </select>
          </div>

          <div class="sort-filter">
            <label>{$t('products.sortBy')}:</label>
            <select
              value={`${$sortBy}-${$sortOrder}`}
              change={(e) => {
                const [field, order] = e.target.value.split('-')
                $updateSort(field, order)
              }}
            >
              <option value="name-asc">{$t('products.nameAsc')}</option>
              <option value="name-desc">{$t('products.nameDesc')}</option>
              <option value="price-asc">{$t('products.priceAsc')}</option>
              <option value="price-desc">{$t('products.priceDesc')}</option>
            </select>
          </div>
        </aside>

        <section class="products-grid">
          <div class="results-info">
            <p>
              {$t('products.showingResults', {
                start: ($currentPage - 1) * $itemsPerPage + 1,
                end: Math.min($currentPage * $itemsPerPage, $filteredProducts.length),
                total: $filteredProducts.length
              })}
            </p>
          </div>

          <div class="product-cards">
            {#each $paginatedProducts as product}
              <article class="product-card" key={product.id}>
                <div class="product-image">
                  <img src={product.image} alt={product.name} />
                </div>
                <div class="product-info">
                  <h3 class="product-name">{product.name}</h3>
                  <p class="product-description">{product.description}</p>
                  <div class="product-price">
                    <span class="price">{product.price} €</span>
                    {#if product.originalPrice}
                      <span class="original-price">{product.originalPrice} €</span>
                    {/if}
                  </div>
                  <div class="product-actions">
                    <button
                      click={() => $addToCart(product.id)}
                      class="add-to-cart-btn"
                    >
                      {$t('products.addToCart')}
                    </button>
                    <a href={`/${$locale}/products/${product.slug}`} class="view-details">
                      {$t('products.viewDetails')}
                    </a>
                  </div>
                </div>
              </article>
            {/each}
          </div>

          {#if $totalPages > 1}
            <nav class="pagination">
              <button
                click={() => $goToPage($currentPage - 1)}
                disabled={$currentPage === 1}
                class="pagination-btn"
              >
                {$t('common.previous')}
              </button>

              {#each Array.from({length: $totalPages}, (_, i) => i + 1) as page}
                <button
                  click={() => $goToPage(page)}
                  class={`pagination-btn ${page === $currentPage ? 'active' : ''}`}
                  key={page}
                >
                  {page}
                </button>
              {/each}

              <button
                click={() => $goToPage($currentPage + 1)}
                disabled={$currentPage === $totalPages}
                class="pagination-btn"
              >
                {$t('common.next')}
              </button>
            </nav>
          {/if}
        </section>
      </main>
    {/if}
  </div>
</template>
```

## Key Migration Changes

### 1. Multi-language Route Structure

```yaml
# Before (Legacy)
route: en:/products, fr:/produits, es:/productos, de:/produkte

# After (Modern)
route:
  en: /products
  fr: /produits
  es: /productos
  de: /produkte
locales: [en, fr, es, de]
```

### 2. Signal System Improvements

- All signals now have descriptive keys
- Added computed signals for derived state
- Added signal events for better debugging and analytics
- Used signal batching for related updates

### 3. Template Modernization

- Conditional rendering: `{condition && content}` → `{#if condition}`
- List rendering: `{array.map()}` → `{#each array as item}`
- Event handlers: `onClick` → `click`, `onChange` → `change`

### 4. Performance Optimizations

- Computed signals prevent unnecessary recalculations
- Signal batching reduces update frequency
- Better SSR compatibility with environment checks

### 5. Enhanced Event System

- Added meaningful signal events for user actions
- Better error tracking and analytics
- Locale change tracking

## Migration Benefits

### Before Migration Issues:

- Manual signal function calls `$signal()`
- Inefficient filtering recalculation
- Limited debugging capabilities
- Poor SSR compatibility

### After Migration Benefits:

- ✅ Automatic reactivity with modern signals
- ✅ Computed signals for performance
- ✅ Rich event system for analytics
- ✅ Better SSR/hydration support
- ✅ Cleaner template syntax
- ✅ Structured i18n route handling

## Testing the Migration

### 1. Multi-language Functionality

```bash
# Test all language routes
curl http://localhost:3000/products      # English
curl http://localhost:3000/produits     # French
curl http://localhost:3000/productos    # Spanish
curl http://localhost:3000/produkte     # German
```

### 2. Signal Event Monitoring

```javascript
// Monitor all product-related events
signal.on("products-loaded", console.log);
signal.on("search-updated", console.log);
signal.on("category-changed", console.log);
signal.on("locale-changed", console.log);
```

### 3. Performance Testing

- Test with large product catalogs (1000+ items)
- Verify smooth filtering and sorting
- Check pagination performance
- Test locale switching speed

This migration demonstrates handling complex multi-language applications with proper i18n routing, performance optimization, and enhanced debugging capabilities.
