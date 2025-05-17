export function formatArgs(inputs: string | null, outputs: string | null): string {
    return `${inputs ?? ""} → ${outputs ?? ""}`.trim();
}
