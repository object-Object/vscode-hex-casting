import * as vscode from "vscode";
import registry from "./data/registry.json";

const output = vscode.window.createOutputChannel("Hex Casting");

const selector: vscode.DocumentSelector = [
    { scheme: "file", language: "hexcasting" },
    { scheme: "untitled", language: "hexcasting" },
];

function makeCompletionItems(name: string, translation: string, hasParam: boolean): vscode.CompletionItem[] {
    const base: vscode.CompletionItem = {
        label: {
            label: translation,
            description: name,
        },
        kind: vscode.CompletionItemKind.Function,
        insertText: translation + (hasParam ? ": " : "\n"),
    };
    return [base, { ...base, filterText: name, sortText: "~" + translation }];
}

const completionList: vscode.CompletionItem[] = Object.entries(registry)
    .filter(([name]) => name != "escape")
    .flatMap<vscode.CompletionItem>(([name, translation]) =>
        makeCompletionItems(name, translation, ["mask", "number"].includes(name)),
    );

class PatternCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        const lineStart = position.with({ character: 0 });
        const rangeStart = document.getWordRangeAtPosition(position)?.start ?? lineStart;
        const line = document.getText(new vscode.Range(lineStart, rangeStart));
        return [...completionList, ...makeCompletionItems("escape", "Consideration", !line.includes("Consideration"))];
    }
}

class SpecialCompletionItemProvider implements vscode.CompletionItemProvider {
    constructor(public translation: string, public regex: RegExp) {}

    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        const range = document.getWordRangeAtPosition(position, this.regex);
        if (range === undefined) return;

        const text = document.getText(range);
        const label = `${this.translation}: ${text}`;
        return [
            {
                label,
                range,
                preselect: true,
                filterText: text,
                insertText: label + "\n",
            },
        ];
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
        new SpecialCompletionItemProvider("Numerical Reflection", /-?\d+/),
        ..."-0123456789",
    );

    vscode.languages.registerCompletionItemProvider(
        selector,
        new SpecialCompletionItemProvider("Bookkeeper's Gambit", /[v\-]+/),
        ..."v-",
    );
}

export function deactivate() {}
