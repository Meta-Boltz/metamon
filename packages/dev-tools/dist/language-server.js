#!/usr/bin/env node
import { createConnection, TextDocuments, DiagnosticSeverity, ProposedFeatures, DidChangeConfigurationNotification, TextDocumentSyncKind, DocumentDiagnosticReportKind, } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { MTMFileParser } from './mtm-parser';
import { MTMValidator } from './mtm-validator';
import { MTMCompletionProvider } from './completion-provider';
// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);
// Create a simple text document manager
const documents = new TextDocuments(TextDocument);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
const parser = new MTMFileParser();
const validator = new MTMValidator();
const completionProvider = new MTMCompletionProvider();
connection.onInitialize((params) => {
    const capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation);
    const result = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['"', "'", ':', ' ', '\n']
            },
            diagnosticProvider: {
                interFileDependencies: false,
                workspaceDiagnostics: false
            }
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});
// The content of a text document has changed
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
async function validateTextDocument(textDocument) {
    // Only validate .mtm files
    if (!textDocument.uri.endsWith('.mtm')) {
        return;
    }
    const text = textDocument.getText();
    const diagnostics = [];
    try {
        const parsed = parser.parse(text, textDocument.uri);
        const validationErrors = validator.validate(parsed);
        for (const error of validationErrors) {
            const diagnostic = {
                severity: DiagnosticSeverity.Error,
                range: {
                    start: textDocument.positionAt(error.offset || 0),
                    end: textDocument.positionAt((error.offset || 0) + (error.length || 1))
                },
                message: error.message,
                source: 'metamon'
            };
            if (hasDiagnosticRelatedInformationCapability && error.suggestions) {
                diagnostic.relatedInformation = error.suggestions.map(suggestion => ({
                    location: {
                        uri: textDocument.uri,
                        range: diagnostic.range
                    },
                    message: suggestion
                }));
            }
            diagnostics.push(diagnostic);
        }
    }
    catch (error) {
        const diagnostic = {
            severity: DiagnosticSeverity.Error,
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: Number.MAX_VALUE }
            },
            message: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            source: 'metamon'
        };
        diagnostics.push(diagnostic);
    }
    // Send the computed diagnostics to VSCode
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
connection.onCompletion((textDocumentPosition) => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document || !document.uri.endsWith('.mtm')) {
        return [];
    }
    return completionProvider.provideCompletions(document, textDocumentPosition.position);
});
connection.onCompletionResolve((item) => {
    return completionProvider.resolveCompletion(item);
});
// Diagnostic support
connection.languages.diagnostics.on(async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (document !== undefined) {
        return {
            kind: DocumentDiagnosticReportKind.Full,
            items: await getDiagnostics(document)
        };
    }
    else {
        return {
            kind: DocumentDiagnosticReportKind.Full,
            items: []
        };
    }
});
async function getDiagnostics(textDocument) {
    if (!textDocument.uri.endsWith('.mtm')) {
        return [];
    }
    const text = textDocument.getText();
    const diagnostics = [];
    try {
        const parsed = parser.parse(text, textDocument.uri);
        const validationErrors = validator.validate(parsed);
        for (const error of validationErrors) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: textDocument.positionAt(error.offset || 0),
                    end: textDocument.positionAt((error.offset || 0) + (error.length || 1))
                },
                message: error.message,
                source: 'metamon'
            });
        }
    }
    catch (error) {
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: Number.MAX_VALUE }
            },
            message: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            source: 'metamon'
        });
    }
    return diagnostics;
}
// Make the text document manager listen on the connection
documents.listen(connection);
// Listen on the connection
connection.listen();
