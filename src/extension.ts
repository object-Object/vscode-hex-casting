import * as vscode from "vscode";
import registry from "./data/registry.json";

const rootSection = "hex-casting";

const output = vscode.window.createOutputChannel("Hex Casting");
let appendNewline = vscode.workspace.getConfiguration(rootSection).get<boolean>("appendNewline")!;

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
        insertText: translation + (hasParam ? ": " : appendNewline ? "\n" : ""),
    };
    return [base, { ...base, filterText: name, sortText: "~" + translation }];
}

function makeCompletionList(): vscode.CompletionItem[] {
    return Object.entries(registry)
        .filter(([name]) => name != "escape")
        .flatMap<vscode.CompletionItem>(([name, translation]) =>
            makeCompletionItems(name, translation, ["mask", "number"].includes(name)),
        );
}

let completionList: vscode.CompletionItem[] = makeCompletionList();

function shouldSkipCompletions(line: string): boolean {
    return /\S\s/.test(line.replace("Consideration:", ""));
}

class PatternCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        const lineStart = position.with({ character: 0 });
        const rangeStart = document.getWordRangeAtPosition(position)?.start ?? position;
        const line = document.getText(new vscode.Range(lineStart, rangeStart));
        if (shouldSkipCompletions(line)) return;

        return [...completionList, ...makeCompletionItems("escape", "Consideration", !line.includes("Consideration:"))];
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

        const lineStart = position.with({ character: 0 });
        const line = document.getText(new vscode.Range(lineStart, range.start));
        if (shouldSkipCompletions(line)) return;

        const text = document.getText(range);
        const label = `${this.translation}: ${text}`;
        return [
            {
                label,
                range,
                preselect: true,
                filterText: text,
                insertText: label + (appendNewline ? "\n" : ""),
            },
        ];
    }
}

export function activate(context: vscode.ExtensionContext) {
    vscode.languages.registerCompletionItemProvider(
        selector,
        new PatternCompletionItemProvider(),
        ..."abcdefghijklmnopqrstuvwxyz0123456789\\", // \ is just so the consideration snippet will trigger
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

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("hex-casting.appendNewline")) {
                appendNewline = vscode.workspace.getConfiguration(rootSection).get<boolean>("appendNewline")!;
                completionList = makeCompletionList();
            }
        }),
    );
}

export function deactivate() {}
