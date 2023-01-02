import * as vscode from "vscode";

interface InputBoxParameters {
    title: string;
    step: number;
    totalSteps: number;
    placeholder: string;
    ignoreFocusOut: boolean;
    valuePrefix?: string;
    validate: (value: string) => string | undefined;
}

export default async function showInputBox({
    title,
    step,
    totalSteps,
    placeholder,
    ignoreFocusOut,
    valuePrefix,
    validate,
}: InputBoxParameters) {
    const disposables: vscode.Disposable[] = [];

    const result = await new Promise<string | undefined>((resolve) => {
        const input = vscode.window.createInputBox();
        input.title = title;
        input.placeholder = placeholder;
        input.ignoreFocusOut = ignoreFocusOut;

        if (totalSteps > 1) {
            input.step = step;
            input.totalSteps = totalSteps;
        }

        if (valuePrefix) {
            input.value = valuePrefix;
            input.valueSelection = [valuePrefix.length, valuePrefix.length];
        }

        disposables.push(
            input.onDidAccept(async () => {
                const value = input.value;
                input.enabled = false;
                input.busy = true;
                if (!validate(value)) {
                    input.hide();
                    resolve(value);
                }
                input.enabled = true;
                input.busy = false;
            }),
            input.onDidChangeValue((text) => {
                input.validationMessage = validate(text);
            }),
            input.onDidHide(() => resolve(undefined)),
        );

        input.show();
    });

    disposables.forEach((d) => d.dispose());
    return result;
}
