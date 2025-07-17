import type { MetamonRouter, RouteInfo, RouteChangeCallback } from '../types/router.js';
export declare class MetamonRouterImpl implements MetamonRouter {
    private routes;
    private routePatterns;
    private currentRoute;
    private routeChangeCallbacks;
    register(path: string, component: string, framework: string): void;
    navigate(path: string, params?: Record<string, any>): void;
    getCurrentRoute(): RouteInfo;
    onRouteChange(callback: RouteChangeCallback): void;
    offRouteChange(callback: RouteChangeCallback): void;
    private handleRouteChange;
    private findMatchingRoute;
    private createRoutePattern;
    private extractRouteParams;
    private extractParamNames;
    private parseQueryString;
    private createNotFoundRoute;
    destroy(): void;
}
export declare const metamonRouter: MetamonRouterImpl;
