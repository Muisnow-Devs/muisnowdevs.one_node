export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export function classFormat(className: (string | null | undefined | boolean)[]) {
    return className.filter(e => !!e).join(" ");
}