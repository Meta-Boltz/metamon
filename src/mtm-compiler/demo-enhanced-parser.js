// Demo of Enhanced MTM Parser
const { EnhancedMTMParser } = require('./enhanced-parser.js');

function demo() {
  console.log('🔮 Enhanced MTM Parser Demo\n');

  const parser = new EnhancedMTMParser();

  const sampleMTMFile = `---
route: "/user/profile"
title: "User Profile"
compileJsMode: "external.js"
description: "User profile management page"
---

import UserCard from "@components/UserCard.tsx"
import ProfileForm from "@components/ProfileForm.vue"
import NotificationBell from "@components/NotificationBell.svelte"

$user! = signal('user', { name: 'John', email: 'john@example.com' })
$notifications! = signal('notifications', [])
$greeting = "Welcome, " + $user.name + "!"

$handleSave = () => {
  console.log('Saving profile:', $user)
  // Save user profile logic here
}

$handleNotificationClick = (notification) => {
  console.log('Clicked notification:', notification)
}

<template>
  <div class="profile-page">
    <header>
      <h1>{$greeting}</h1>
      <NotificationBell notifications={$notifications} onClick={$handleNotificationClick} />
    </header>
    
    <main>
      <UserCard user={$user} />
      <ProfileForm user={$user} onSave={$handleSave} />
    </main>
    
    <nav>
      <a href="/dashboard">Dashboard</a>
      <a href="/settings">Settings</a>
      <a href="/logout">Logout</a>
    </nav>
  </div>
</template>`;

  console.log('📄 Sample MTM File:');
  console.log('─'.repeat(50));
  console.log(sampleMTMFile);
  console.log('─'.repeat(50));

  const ast = parser.parse(sampleMTMFile, 'user-profile.mtm');

  console.log('\n🔍 Parsed AST:');
  console.log('─'.repeat(50));

  console.log('\n📋 Frontmatter:');
  Object.entries(ast.frontmatter).forEach(([key, value]) => {
    console.log(`  ${key}: "${value}"`);
  });

  console.log('\n📦 Imports:');
  ast.imports.forEach(imp => {
    console.log(`  ${imp.name} (${imp.framework}) from "${imp.path}"`);
  });

  console.log('\n🔄 Variables:');
  ast.variables.forEach(variable => {
    console.log(`  $${variable.name} (${variable.type}): ${variable.value}`);
  });

  console.log('\n⚡ Functions:');
  ast.functions.forEach(func => {
    console.log(`  $${func.name}${func.params}`);
  });

  console.log('\n🎨 Template:');
  console.log(`  ${ast.template.content.split('\n').length} lines of HTML template`);

  console.log('\n✅ Framework Detection:');
  console.log(`  Detected framework: ${ast.framework}`);

  console.log('\n🔧 Validation:');
  const validationErrors = parser.validateFrontmatter(ast.frontmatter);
  if (validationErrors.length === 0) {
    console.log('  ✓ All frontmatter is valid');
  } else {
    console.log('  ❌ Validation errors:');
    validationErrors.forEach(error => {
      console.log(`    - ${error.field}: ${error.message}`);
    });
  }

  console.log('\n🎯 Path Resolution Examples:');
  ast.imports.forEach(imp => {
    const resolved = parser.resolveComponentPath(imp.path);
    console.log(`  "${imp.path}" → "${resolved}"`);
  });

  console.log('\n🎉 Enhanced MTM Parser Demo Complete!');
}

demo();