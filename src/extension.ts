import * as vscode from "vscode";
import registry from "./data/registry.json";

const selector: vscode.DocumentSelector = {scheme: "file", language: "hexcasting"};

const triggerCharacters = [..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"];

const completionList: vscode.CompletionItem[] = Object.entries(registry).flatMap(
    ([name, translation]) => [
        {label: translation, detail: name, kind: vscode.CompletionItemKind.Function},
        {label: translation, filterText: name, detail: name, kind: vscode.CompletionItemKind.Function},
    ]
);

class HexCastingCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        return completionList;
    }
}

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel("Hex Casting");
    output.appendLine(triggerCharacters.toString());

    vscode.languages.registerCompletionItemProvider(
        selector,
        new HexCastingCompletionItemProvider(),
        ...triggerCharacters,
    );
}

export function deactivate() {}
