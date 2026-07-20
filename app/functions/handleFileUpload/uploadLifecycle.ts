export function scheduleUploadStart(
    upload: (signal: AbortSignal) => Promise<void>,
) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
        void upload(controller.signal);
    }, 0);

    return () => {
        clearTimeout(timer);
        controller.abort();
    };
}
