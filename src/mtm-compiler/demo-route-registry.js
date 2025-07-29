/**
 * Demo script for RouteRegistry functionality
 */

const { RouteRegistry } = require('./route-registry');

console.log('🚀 RouteRegistry Demo\n');

// Create a new registry
const registry = new RouteRegistry();

// Register some routes
console.log('📝 Registering routes...');

try {
  registry.register('/home', {
    file: 'pages/home.mtm',
    metadata: { title: 'Home Page' }
  });

  registry.register('/about', {
    file: 'pages/about.mtm',
    metadata: { title: 'About Us' }
  });

  registry.register('/user/[id]', {
    file: 'pages/user.mtm',
    metadata: { title: 'User Profile' }
  });

  registry.register('/blog/[category]/[slug]', {
    file: 'pages/blog-post.mtm',
    metadata: { title: 'Blog Post' }
  });

  console.log('✅ Routes registered successfully\n');
} catch (error) {
  console.error('❌ Error registering routes:', error.message);
}

// Show all registered routes
console.log('📋 All registered routes:');
const allRoutes = registry.getAll();
for (const [path, config] of allRoutes) {
  console.log(`  ${path} -> ${config.file} (${config.dynamic ? 'dynamic' : 'static'})`);
}
console.log();

// Test route resolution
console.log('🔍 Testing route resolution:');

const testPaths = [
  '/home',
  '/about',
  '/user/123',
  '/user/john-doe',
  '/blog/tech/my-awesome-post',
  '/blog/news/breaking-news?featured=true&sort=date',
  '/nonexistent'
];

testPaths.forEach(path => {
  const match = registry.resolve(path);
  if (match) {
    console.log(`  ✅ ${path}`);
    console.log(`     Route: ${match.route.path}`);
    console.log(`     File: ${match.route.file}`);
    if (Object.keys(match.params).length > 0) {
      console.log(`     Params: ${JSON.stringify(match.params)}`);
    }
    if (Object.keys(match.query).length > 0) {
      console.log(`     Query: ${JSON.stringify(match.query)}`);
    }
  } else {
    console.log(`  ❌ ${path} - No match found`);
  }
  console.log();
});

// Test route validation
console.log('🔍 Testing route validation:');
const validationResults = registry.validateRoutes();
if (validationResults.length === 0) {
  console.log('  ✅ All routes are valid');
} else {
  validationResults.forEach(result => {
    console.log(`  ❌ ${result.type}: ${result.message}`);
  });
}
console.log();

// Test conflict detection
console.log('🔍 Testing conflict detection:');
try {
  registry.register('/user/[userId]', {
    file: 'pages/user-alt.mtm'
  });
  console.log('  ❌ Expected conflict error but none was thrown');
} catch (error) {
  console.log('  ✅ Conflict detected correctly:', error.message);
}

console.log('\n🎉 RouteRegistry demo completed!');