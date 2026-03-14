type TextResourcesApi = {
    defaultLocale: string;
    locale: string;
    bundles: Record<string, Record<string, string> | undefined>;
    getStrings(locale?: string): Record<string, string>;
    detectBrowserLocale(): string;
    setLocale(locale: string, options?: {
        silent?: boolean;
        root?: Document | HTMLElement;
    }): boolean;
    getLocale(): string;
    extend(locale: string, strings?: Record<string, string>): void;
    get(key: string | null | undefined, fallback?: string): string;
    format(key: string | null | undefined, params?: Record<string, string | number | boolean>, fallback?: string): string;
    apply(root?: Document | HTMLElement): void;
};
declare const TextResources: TextResourcesApi;
export { TextResources };
