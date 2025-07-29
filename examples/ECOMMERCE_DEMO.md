# MTM E-commerce Demo

A comprehensive e-commerce application built with the Enhanced MTM Framework, demonstrating real-world usage patterns, complex state management, and the chunk loading fix in action.

## 🛒 Features

### Core E-commerce Functionality

- **Product Catalog**: Browse products with filtering, sorting, and pagination
- **Product Details**: Detailed product pages with images, reviews, and specifications
- **Shopping Cart**: Add/remove items, quantity management, and persistent storage
- **Search & Filter**: Advanced filtering by category, price, rating, and more
- **Responsive Design**: Mobile-first design with Tailwind CSS

### MTM Framework Features

- **Chunk Loading Fix**: Safe property assignment prevents TypeError issues
- **Client-side Routing**: Seamless navigation with browser history support
- **Layout System**: Reusable layouts with Next.js-style architecture
- **Reactive State**: Real-time cart updates and UI synchronization
- **Component Integration**: Ready for React, Vue, Solid, and Svelte components

## 🚀 Quick Start

### Option 1: E-commerce Demo (Recommended)

```bash
# Start development server
npm run dev

# Open the e-commerce demo
open http://localhost:3000/ecommerce.html
```

### Option 2: Build and Serve

```bash
# Build the application
npm run build

# Serve the built files
npm run preview

# Navigate to the e-commerce demo
open http://localhost:4173/ecommerce.html
```

## 📁 Project Structure

```
examples/
├── src/
│   ├── layouts/
│   │   └── ecommerce.mtm          # Main e-commerce layout
│   ├── pages/
│   │   ├── ecommerce-home.mtm     # Homepage with hero and featured products
│   │   ├── products.mtm           # Product listing with filters
│   │   ├── product-detail.mtm     # Individual product pages
│   │   └── cart.mtm               # Shopping cart management
│   ├── components/                # Framework-specific components
│   └── styles/                    # CSS and styling
├── build/
│   └── mtm-plugin.js             # MTM Vite plugin with chunk loading fix
├── tests/
│   └── chunk-loading-fix.test.js # Tests for safe property assignment
├── ecommerce.html                # E-commerce demo entry point
└── dist/                         # Built application (chunks generated here)
```

## 🛍️ E-commerce Pages

### 1. Homepage (`/`)

- **Hero Section**: Welcome message with call-to-action buttons
- **Featured Categories**: Interactive category cards with hover effects
- **Featured Products**: Dynamically loaded product grid
- **Newsletter Signup**: Email subscription with validation

### 2. Products Page (`/products`)

- **Product Grid/List**: Toggle between grid and list views
- **Advanced Filtering**: Category, price range, and rating filters
- **Sorting Options**: Name, price, rating, and newest first
- **Pagination**: Navigate through large product catalogs
- **Search Integration**: Filter products by search terms

### 3. Product Detail Page (`/product-detail`)

- **Image Gallery**: Main image with thumbnail navigation
- **Product Information**: Name, price, rating, and reviews
- **Product Options**: Color and size selection
- **Quantity Selection**: Increment/decrement controls
- **Tabbed Content**: Description, specifications, and reviews
- **Related Products**: Suggested items based on category

### 4. Shopping Cart (`/cart`)

- **Cart Management**: Add, remove, and update quantities
- **Order Summary**: Subtotal, shipping, tax, and total calculations
- **Promo Codes**: Discount code application with validation
- **Persistent Storage**: Cart data saved to localStorage
- **Recommended Products**: Cross-sell opportunities

## 🔧 Technical Implementation

### Chunk Loading Fix Integration

The e-commerce demo showcases the chunk loading fix in real-world scenarios:

```javascript
// Safe property assignment embedded in compiled chunks
function safeAssign(obj, prop, value) {
  // Handles getter-only properties by creating new objects
  // Preserves prototype chains and existing properties
  // Provides fallback for error scenarios
}

// Used throughout the application for dynamic updates
const updatedContainer = safeAssign(container, "innerHTML", content);
```

### State Management

The application uses MTM's reactive signals for state management:

```javascript
// Cart state
$cartItems! = signal('cartItems', [])
$cartCount! = signal('cartCount', 0)

// Product filtering
$filteredProducts! = signal('filteredProducts', [])
$filters! = signal('filters', { categories: [], priceRange: null })
```

### Layout System

The e-commerce layout provides consistent structure:

```mtm
---
layoutName: "ecommerce"
function: EcommerceLayout
---

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header with search, navigation, and cart -->
    <!-- Main content area -->
    <main><slot /></main>
    <!-- Footer -->
  </div>
</template>
```

### Routing System

Enhanced routing with parameter support:

```javascript
const routes = {
  "/": () => import("./src/pages/ecommerce-home.mtm"),
  "/products": () => import("./src/pages/products.mtm"),
  "/product/:id": () => import("./src/pages/product-detail.mtm"),
  "/cart": () => import("./src/pages/cart.mtm"),
};
```

## 🧪 Testing

### Chunk Loading Fix Tests

```bash
# Run chunk loading fix tests
npm run test -- tests/chunk-loading-fix.test.js
```

The tests verify:

- ✅ Writable property handling
- ✅ Getter-only property handling
- ✅ Non-writable property handling
- ✅ Prototype chain preservation
- ✅ Error recovery mechanisms

### Manual Testing Scenarios

1. **Cart Persistence**: Add items, refresh page, verify cart contents
2. **Product Filtering**: Apply multiple filters, verify results
3. **Responsive Design**: Test on mobile, tablet, and desktop
4. **Navigation**: Use browser back/forward buttons
5. **Error Handling**: Test with invalid product IDs

## 🎨 Styling and Design

### Tailwind CSS Integration

- **Utility-first**: Rapid UI development with utility classes
- **Responsive Design**: Mobile-first responsive breakpoints
- **Component Variants**: Hover states, focus states, and transitions
- **Custom Components**: Reusable component patterns

### Design System

- **Color Palette**: Blue primary, gray neutrals, semantic colors
- **Typography**: Consistent font sizes and weights
- **Spacing**: Systematic spacing scale
- **Shadows**: Subtle elevation for cards and modals

## 🚀 Performance Features

### Build Optimizations

- **Code Splitting**: Automatic route-based splitting
- **Tree Shaking**: Remove unused code
- **Asset Optimization**: Image and CSS optimization
- **Caching**: Proper cache headers for static assets

### Runtime Performance

- **Lazy Loading**: Components loaded on demand
- **Virtual Scrolling**: Efficient large list rendering
- **Debounced Search**: Optimized search input handling
- **Memoization**: Cached computed values

## 🔮 Future Enhancements

### Planned Features

- **User Authentication**: Login, registration, and user profiles
- **Checkout Process**: Multi-step checkout with payment integration
- **Order Management**: Order history and tracking
- **Wishlist**: Save items for later
- **Product Reviews**: User-generated reviews and ratings
- **Admin Dashboard**: Product and order management

### Framework Integrations

- **React Components**: Product cards, forms, and modals
- **Vue Components**: Interactive widgets and animations
- **Solid Components**: High-performance data displays
- **Svelte Components**: Smooth transitions and effects

## 📊 Metrics and Analytics

### Performance Metrics

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

### Business Metrics

- **Conversion Rate**: Track add-to-cart and checkout rates
- **Average Order Value**: Monitor cart value trends
- **User Engagement**: Page views and session duration
- **Search Performance**: Query success rates

## 🤝 Contributing

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Open `http://localhost:3000/ecommerce.html`

### Code Standards

- **MTM Syntax**: Follow MTM framework conventions
- **TypeScript**: Use TypeScript for component props
- **Testing**: Write tests for new features
- **Documentation**: Update README for new features

## 📝 License

This e-commerce demo is part of the MTM Framework examples and is provided for educational and demonstration purposes.

---

**Built with ❤️ using the Enhanced MTM Framework**

_Demonstrating the power of modern web development with chunk loading fixes, reactive state management, and multi-framework integration._
