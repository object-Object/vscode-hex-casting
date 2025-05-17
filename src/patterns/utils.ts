export function formatArgs(
    inputs: string | null,
    outputs: string | null,
    { underline = false }: { underline?: boolean } = {},
): string {
    if (underline) {
        inputs &&= `<u>${inputs}</u>`;
        outputs &&= `<u>${outputs}</u>`;
    }
    return `${inputs ?? ""} → ${outputs ?? ""}`.trim();
}
