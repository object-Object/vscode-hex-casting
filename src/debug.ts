import * as vscode from "vscode";

class ServerDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(
        session: vscode.DebugSession,
        executable: vscode.DebugAdapterExecutable | undefined,
    ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        return new vscode.DebugAdapterServer(4444);
    }
}

export function activateHexlrDebug(context: vscode.ExtensionContext) {
    let factory = new ServerDescriptorFactory();
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory("hexlr", factory));
}
