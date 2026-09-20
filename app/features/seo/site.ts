export const SITE_URL = "https://muisnowdevs.one";
export const absoluteUrl = (path: string) => new URL(path, SITE_URL).href;
