export function classFormat(className: (string | null | undefined | boolean)[]) {
    return className.filter(e => !!e).join(" ");
}