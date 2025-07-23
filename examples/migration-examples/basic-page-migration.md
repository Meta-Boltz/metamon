# Basic Page Migration Example

This example shows how to migrate a simple static page from legacy to modern MTM format.

## Before Migration (Legacy Format)

**File:** `src/pages/about.mtm`

```mtm
---
page_title: About Our Company
page_description: Learn more about our company history and values
meta_keywords: about, company, history, values, team
template: default
http_status: 200
route: /about
---

<div class="about-page">
  <header class="page-header">
    <h1>About Our Company</h1>
    <p class="subtitle">Building the future, one step at a time</p>
  </header>

  <main class="content">
    <section class="history">
      <h2>Our History</h2>
      <p>Founded in 2020, we started with a simple mission: to create amazing software that makes people's lives better.</p>
    </section>

    <section class="values">
      <h2>Our Values</h2>
      <ul>
        <li>Innovation</li>
        <li>Quality</li>
        <li>Customer Focus</li>
        <li>Teamwork</li>
      </ul>
    </section>

    <section class="team">
      <h2>Meet the Team</h2>
      <p>We're a diverse group of passionate individuals working together to achieve our goals.</p>
    </section>
  </main>
</div>
```

## Migration Command

```bash
npx mtm-migrate migrate src/pages/about.mtm --verbose
```

## After Migration (Modern Format)

**File:** `src/pages/about.mtm`

```mtm
---
title: About Our Company
description: Learn more about our company history and values
keywords: [about, company, history, values, team]
layout: default
status: 200
route: /about
---

<template>
  <div class="about-page">
    <header class="page-header">
      <h1>About Our Company</h1>
      <p class="subtitle">Building the future, one step at a time</p>
    </header>

    <main class="content">
      <section class="history">
        <h2>Our History</h2>
        <p>Founded in 2020, we started with a simple mission: to create amazing software that makes people's lives better.</p>
      </section>

      <section class="values">
        <h2>Our Values</h2>
        <ul>
          <li>Innovation</li>
          <li>Quality</li>
          <li>Customer Focus</li>
          <li>Teamwork</li>
        </ul>
      </section>

      <section class="team">
        <h2>Meet the Team</h2>
        <p>We're a diverse group of passionate individuals working together to achieve our goals.</p>
      </section>
    </main>
  </div>
</template>
```

## Changes Made

The migration tool automatically made these changes:

1. **Frontmatter field renames:**

   - `page_title` → `title`
   - `page_description` → `description`
   - `meta_keywords` → `keywords` (string to array conversion)
   - `template` → `layout`
   - `http_status` → `status`

2. **Template structure:**

   - Wrapped content in `<template>` tags

3. **Keywords format:**
   - Converted comma-separated string to array format

## Migration Report

```json
{
  "success": true,
  "filePath": "src/pages/about.mtm",
  "changes": [
    {
      "type": "field_rename",
      "description": "Renamed field 'page_title' to 'title'",
      "before": "page_title",
      "after": "title"
    },
    {
      "type": "field_rename",
      "description": "Renamed field 'page_description' to 'description'",
      "before": "page_description",
      "after": "description"
    },
    {
      "type": "field_rename",
      "description": "Renamed field 'meta_keywords' to 'keywords'",
      "before": "meta_keywords",
      "after": "keywords"
    },
    {
      "type": "keywords_format",
      "description": "Converted keywords from string to array",
      "before": "about, company, history, values, team",
      "after": ["about", "company", "history", "values", "team"]
    },
    {
      "type": "field_rename",
      "description": "Renamed field 'template' to 'layout'",
      "before": "template",
      "after": "layout"
    },
    {
      "type": "field_rename",
      "description": "Renamed field 'http_status' to 'status'",
      "before": "http_status",
      "after": "status"
    },
    {
      "type": "template_wrapper",
      "description": "Wrapped content in template block",
      "after": "Added <template> wrapper"
    }
  ],
  "warnings": [],
  "errors": []
}
```

## Validation

After migration, validate the file:

```bash
npx mtm-migrate validate src/pages/about.mtm
```

**Output:**

```
✅ Validation Results:
   Total files: 1
   Valid: 1 (100%)
   Invalid: 0 (0%)
```

## Testing

The migrated page should work identically to the original:

1. **Route access:** `http://localhost:3000/about`
2. **SEO metadata:** Title, description, and keywords properly set
3. **Layout:** Uses the default layout
4. **Status code:** Returns 200 OK
5. **Content:** All sections render correctly

This is a simple migration with no interactive elements, making it ideal for testing the basic migration process.
