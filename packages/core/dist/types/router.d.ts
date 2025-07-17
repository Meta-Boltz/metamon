/**
 * Route information
 */
export interface RouteInfo {
    path: string;
    params: Record<string, any>;
    query: Record<string, any>;
    component: string;
    framework: string;
}
/**
 * Route change callback type
 */
export type RouteChangeCallback = (route: RouteInfo) => void;
/**
 * Interface for client-side routing in Metamon applications
 */
export interface MetamonRouter {
    register(path: string, component: string, framework: string): void;
    navigate(path: string, params?: Record<string, any>): void;
    getCurrentRoute(): RouteInfo;
    onRouteChange(callback: RouteChangeCallback): void;
}
/**
 * Route registration details
 */
export interface RouteRegistration {
    path: string;
    component: string;
    framework: string;
    pattern?: RegExp;
}
