// Simple server to serve compiled MTM examples
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Serve static files from compiled directory
app.use('/compiled', express.static(path.join(__dirname, '../compiled')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Main index page showing all compiled examples
app.get('/', (req, res) => {
  const compiledDir = path.join(__dirname, '../compiled');
  let examples = [];

  if (fs.existsSync(compiledDir)) {
    examples = fs.readdirSync(compiledDir)
      .filter(file => file.endsWith('.html'))
      .map(file => ({
        name: file.replace('.html', ''),
        file: file,
        url: `/compiled/${file}`
      }));
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MTM Framework Examples</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .logo {
            font-size: 3rem;
            margin-bottom: 10px;
        }
        
        .title {
            color: #2c3e50;
            font-size: 2rem;
            margin-bottom: 10px;
        }
        
        .subtitle {
            color: #7f8c8d;
            font-size: 1.1rem;
        }
        
        .examples-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        
        .example-card {
            border: 2px solid #667eea;
            border-radius: 8px;
            padding: 20px;
            background: #f8f9ff;
            text-align: center;
            transition: transform 0.2s;
        }
        
        .example-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        }
        
        .example-card h3 {
            color: #2c3e50;
            margin-bottom: 15px;
            text-transform: capitalize;
        }
        
        .example-card a {
            display: inline-block;
            background: #667eea;
            color: white;
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: 600;
            transition: background 0.2s;
        }
        
        .example-card a:hover {
            background: #5a6fd8;
        }
        
        .info {
            background: #e8f4fd;
            border: 1px solid #bee5eb;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .info h4 {
            color: #0c5460;
            margin-top: 0;
        }
        
        .info p {
            color: #0c5460;
            margin-bottom: 0;
        }
        
        .compile-instructions {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .compile-instructions h4 {
            color: #495057;
            margin-top: 0;
        }
        
        .compile-instructions code {
            background: #e9ecef;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        
        .compile-instructions pre {
            background: #2c3e50;
            color: #ecf0f1;
            padding: 15px;
            border-radius: 6px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="logo">🔮</div>
            <h1 class="title">MTM Framework Examples</h1>
            <p class="subtitle">Write once, compile to React, Vue, Svelte, SolidJS, or Pure HTML/JS</p>
        </header>
        
        <div class="info">
            <h4>🚀 What is MTM Framework?</h4>
            <p>
                MTM (Meta-Template-Metamon) is a revolutionary meta-framework that lets you write components 
                once using a unified syntax and compile them to multiple target frameworks. The pure HTML/JS 
                compilation works like a merge between PHP and Next.js - no framework dependencies needed!
            </p>
        </div>
        
        ${examples.length > 0 ? `
        <div class="examples-grid">
            ${examples.map(example => `
                <div class="example-card">
                    <h3>${example.name}</h3>
                    <p>Compiled from MTM to Pure HTML/JS</p>
                    <a href="${example.url}" target="_blank">View Example</a>
                </div>
            `).join('')}
        </div>
        ` : `
        <div class="compile-instructions">
            <h4>📝 No compiled examples found</h4>
            <p>To see examples, first compile the MTM components:</p>
            <pre><code>npm run compile-examples</code></pre>
            <p>Or compile individual files:</p>
            <pre><code>node src/mtm-compiler/cli.js compile examples/mtm-components/counter.mtm</code></pre>
        </div>
        `}
        
        <div class="compile-instructions">
            <h4>🛠️ How to Use MTM Framework</h4>
            <p>1. Write your component using MTM syntax (see <code>examples/mtm-components/</code>)</p>
            <p>2. Compile to your target framework:</p>
            <pre><code># Compile to pure HTML/JS (no framework needed)
mtm compile counter.mtm

# Compile to React (coming soon)
mtm compile counter.react.mtm

# Compile all components
mtm compile-all ./components</code></pre>
            <p>3. The compiled output works like PHP + Next.js - complete HTML files with embedded reactive JavaScript!</p>
        </div>
    </div>
</body>
</html>`;

  res.send(html);
});

app.listen(PORT, () => {
  console.log(`🔮 MTM Framework Examples Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving compiled examples from: ${path.join(__dirname, '../compiled')}`);
  console.log(`\n🚀 To compile examples, run: npm run compile-examples`);
});

module.exports = app;