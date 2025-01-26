export const getStorage = (key: string) => localStorage.getItem(key);
export const setStorage = (key: string, value: string) => localStorage.setItem(key, value);
export const downloadURIWithBlob = (url: string, name?: string) => {
    fetch(url)
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            downloadURI(url, name);
            window.URL.revokeObjectURL(url);
        });
}
export const downloadURI = (url: string, name?: string) => {
    const link = document.createElement("a");
    if (name)
        link.setAttribute('download', name);
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
}