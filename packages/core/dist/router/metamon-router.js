export class MetamonRouterImpl {
    constructor() {
        this.routes = new Map();
        this.routePatterns = [];
        this.currentRoute = null;
        this.routeChangeCallbacks = new Set();
    }
    register(path, component, framework) {
        const registration = {
            path,
            component,
            framework,
            pattern: this.createRoutePattern(path)
        };
        this.routes.set(path, registration);
        this.routePatterns.push(registration);
    }
    navigate(path, params) {
        let url = path;
        if (params && Object.keys(params).length > 0) {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, String(value));
                }
            });
            const queryString = searchParams.toString();
            if (queryString) {
                url += (path.includes('?') ? '&' : '?') + queryString;
            }
        }
        if (typeof window !== 'undefined' && window.location) {
            try {
                const urlObj = new URL(url, 'http://localhost');
                window.location.pathname = urlObj.pathname;
                window.location.search = urlObj.search;
                if (window.history) {
                    window.history.pushState({}, '', url);
                }
            }
            catch (e) {
                window.location.pathname = url.split('?')[0];
                window.location.search = url.includes('?') ? '?' + url.split('?')[1] : '';
            }
        }
        this.handleRouteChange();
    }
    getCurrentRoute() {
        if (!this.currentRoute) {
            this.handleRouteChange();
        }
        return this.currentRoute || this.createNotFoundRoute();
    }
    onRouteChange(callback) {
        this.routeChangeCallbacks.add(callback);
    }
    offRouteChange(callback) {
        this.routeChangeCallbacks.delete(callback);
    }
    handleRouteChange() {
        const currentPath = typeof window !== 'undefined' && window.location
            ? window.location.pathname
            : '/';
        const currentSearch = typeof window !== 'undefined' && window.location
            ? window.location.search
            : '';
        const matchedRoute = this.findMatchingRoute(currentPath);
        if (matchedRoute) {
            const params = this.extractRouteParams(currentPath, matchedRoute);
            const query = this.parseQueryString(currentSearch);
            this.currentRoute = {
                path: currentPath,
                params,
                query,
                component: matchedRoute.component,
                framework: matchedRoute.framework
            };
        }
        else {
            this.currentRoute = this.createNotFoundRoute();
        }
        this.routeChangeCallbacks.forEach(callback => {
            try {
                callback(this.currentRoute);
            }
            catch (error) {
                console.error('Error in route change callback:', error);
            }
        });
    }
    findMatchingRoute(path) {
        for (const [routePath, registration] of this.routes) {
            if (routePath === path) {
                return registration;
            }
        }
        for (const registration of this.routePatterns) {
            if (registration.pattern && registration.pattern.test(path)) {
                return registration;
            }
        }
        return null;
    }
    createRoutePattern(path) {
        const escapedPath = path.replace(/\//g, '\\/');
        const patternStr = escapedPath.replace(/:([^\/]+)/g, '([^\/]+)');
        return new RegExp('^' + patternStr + '$');
    }
    extractRouteParams(currentPath, route) {
        const params = {};
        if (!route.pattern) {
            return params;
        }
        const match = currentPath.match(route.pattern);
        if (!match) {
            return params;
        }
        const paramNames = this.extractParamNames(route.path);
        paramNames.forEach((name, index) => {
            const value = match[index + 1];
            if (value !== undefined) {
                params[name] = decodeURIComponent(value);
            }
        });
        return params;
    }
    extractParamNames(path) {
        const paramNames = [];
        const matches = path.matchAll(/:([^\/]+)/g);
        for (const match of matches) {
            if (match[1]) {
                paramNames.push(match[1]);
            }
        }
        return paramNames;
    }
    parseQueryString(search) {
        const query = {};
        if (!search || search.length <= 1) {
            return query;
        }
        const params = new URLSearchParams(search);
        params.forEach((value, key) => {
            if (query[key]) {
                if (Array.isArray(query[key])) {
                    query[key].push(value);
                }
                else {
                    query[key] = [query[key], value];
                }
            }
            else {
                query[key] = value;
            }
        });
        return query;
    }
    createNotFoundRoute() {
        const currentPath = typeof window !== 'undefined' && window.location
            ? window.location.pathname
            : '/';
        const currentSearch = typeof window !== 'undefined' && window.location
            ? window.location.search
            : '';
        return {
            path: currentPath,
            params: {},
            query: this.parseQueryString(currentSearch),
            component: 'NotFound',
            framework: 'react'
        };
    }
    destroy() {
        this.routeChangeCallbacks.clear();
    }
}
export const metamonRouter = new MetamonRouterImpl();
