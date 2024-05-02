import * as vscode from "vscode";

// not exhaustive
interface HexDebugLaunchArgs extends vscode.DebugConfiguration {
    port?: number;
}

class ServerDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(
        session: vscode.DebugSession,
        executable: vscode.DebugAdapterExecutable | undefined,
    ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        let launchArgs = session.configuration as HexDebugLaunchArgs;
        return new vscode.DebugAdapterServer(launchArgs.port ?? 4444);
    }
}

export function activateHexDebug(context: vscode.ExtensionContext) {
    let factory = new ServerDescriptorFactory();
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory("hexdebug", factory));
}
