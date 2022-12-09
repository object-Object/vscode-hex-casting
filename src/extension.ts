import * as vscode from "vscode";
import registry from "./data/registry.json";

const output = vscode.window.createOutputChannel("Hex Casting");

const selector: vscode.DocumentSelector = {scheme: "file", language: "hexcasting"};

const completionList: vscode.CompletionItem[] = Object.entries(registry).flatMap<vscode.CompletionItem>(
    ([name, translation]) => {
        const base: vscode.CompletionItem = {
            label: {
                label: translation,
                description: name,
            },
            kind: vscode.CompletionItemKind.Function,
            insertText: ["mask", "number"].includes(name) ? translation + ": " : translation,
        };
        return [base, {...base, filterText: name, sortText: "~" + translation}];
    }
);

class PatternCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        return completionList;
    }
}

class NumberCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        const range = document.getWordRangeAtPosition(position, /-?\d+/);
        if (range === undefined) return;

        const text = document.getText(range);
        return [{
            label: `Numerical Reflection: ${text}`,
            range,
            preselect: true,
            filterText: text,
        }];
    }
}

class BookkeeperCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        const range = document.getWordRangeAtPosition(position, /[v\-]+/);
        if (range === undefined) return;

        const text = document.getText(range);
        return [{
            label: `Bookkeeper's Gambit: ${text}`,
            range,
            preselect: true,
            filterText: text,
        }];
    }
}

export function activate(context: vscode.ExtensionContext) {
    vscode.languages.registerCompletionItemProvider(
        selector,
        new PatternCompletionItemProvider(),
        ..."abcdefghijklmnopqrstuvwxyz\\", // \ is just so the consideration snippet will trigger
    );

    vscode.languages.registerCompletionItemProvider(
        selector,
        new NumberCompletionItemProvider(),
        ..."-0123456789"
    );

    vscode.languages.registerCompletionItemProvider(
        selector,
        new BookkeeperCompletionItemProvider(),
        ..."v-"
    );
}

export function deactivate() {}
