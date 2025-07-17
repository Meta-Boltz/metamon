import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  // Language server setup
  const serverModule = context.asAbsolutePath('../dist/language-server.js');
  
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] }
    }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'mtm' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.mtm')
    }
  };

  client = new LanguageClient(
    'metamonLanguageServer',
    'Metamon Language Server',
    serverOptions,
    clientOptions
  );

  // Start the client and server
  client.start();

  // Register commands
  const commands = [
    vscode.commands.registerCommand('metamon.validateFile', validateCurrentFile),
    vscode.commands.registerCommand('metamon.showFrameworkInfo', showFrameworkInfo),
    vscode.commands.registerCommand('metamon.createMTMFile', createMTMFile)
  ];

  context.subscriptions.push(...commands);
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

async function validateCurrentFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document.fileName.endsWith('.mtm')) {
    vscode.window.showWarningMessage('Please open a .mtm file to validate');
    return;
  }

  // Trigger validation by requesting diagnostics
  await vscode.languages.getDiagnostics(editor.document.uri);
  vscode.window.showInformationMessage('File validation completed');
}

async function showFrameworkInfo() {
  const frameworks = [
    { label: 'React.js', description: 'A JavaScript library for building user interfaces' },
    { label: 'Vue.js', description: 'The Progressive JavaScript Framework' },
    { label: 'Solid.js', description: 'Simple and performant reactivity for building user interfaces' },
    { label: 'Svelte', description: 'Cybernetically enhanced web apps' }
  ];

  const selected = await vscode.window.showQuickPick(frameworks, {
    placeHolder: 'Select a framework to learn more'
  });

  if (selected) {
    vscode.window.showInformationMessage(`${selected.label}: ${selected.description}`);
  }
}

async function createMTMFile() {
  const frameworks = ['reactjs', 'vue', 'solid', 'svelte'];
  const selectedFramework = await vscode.window.showQuickPick(frameworks, {
    placeHolder: 'Select target framework'
  });

  if (!selectedFramework) return;

  const fileName = await vscode.window.showInputBox({
    prompt: 'Enter file name (without extension)',
    placeHolder: 'component-name'
  });

  if (!fileName) return;

  const template = getTemplateForFramework(selectedFramework);
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  
  if (workspaceFolder) {
    const filePath = vscode.Uri.joinPath(workspaceFolder.uri, `${fileName}.mtm`);
    await vscode.workspace.fs.writeFile(filePath, Buffer.from(template));
    
    const document = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(document);
  }
}

function getTemplateForFramework(framework: string): string {
  const templates = {
    reactjs: `---
target: reactjs
channels:
  - event: exampleEvent
    emit: onExampleEvent
---

import React, { useState } from 'react';

export default function Component() {
  const [state, setState] = useState(null);

  const onExampleEvent = (data) => {
    console.log('Received event:', data);
    setState(data);
  };

  return (
    <div>
      <h1>React Component</h1>
      <p>State: {JSON.stringify(state)}</p>
    </div>
  );
}`,
    vue: `---
target: vue
channels:
  - event: exampleEvent
    emit: onExampleEvent
---

<template>
  <div>
    <h1>Vue Component</h1>
    <p>State: {{ state }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const state = ref(null);

const onExampleEvent = (data) => {
  console.log('Received event:', data);
  state.value = data;
};
</script>`,
    solid: `---
target: solid
channels:
  - event: exampleEvent
    emit: onExampleEvent
---

import { createSignal } from 'solid-js';

export default function Component() {
  const [state, setState] = createSignal(null);

  const onExampleEvent = (data) => {
    console.log('Received event:', data);
    setState(data);
  };

  return (
    <div>
      <h1>Solid Component</h1>
      <p>State: {JSON.stringify(state())}</p>
    </div>
  );
}`,
    svelte: `---
target: svelte
channels:
  - event: exampleEvent
    emit: onExampleEvent
---

<script>
  let state = null;

  function onExampleEvent(data) {
    console.log('Received event:', data);
    state = data;
  }
</script>

<div>
  <h1>Svelte Component</h1>
  <p>State: {JSON.stringify(state)}</p>
</div>`
  };

  return templates[framework as keyof typeof templates] || templates.reactjs;
}