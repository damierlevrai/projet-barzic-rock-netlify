/**
 * 🛡️ ROUTE GUARD - Sécurité des routes Barzik Rock
 * Protection simplifiée par rôle utilisateur
 */

import Auth from './auth.js';

class RouteGuard {
    
    // 🎯 Routes publiques (accessibles sans connexion)
    static PUBLIC_ROUTES = [
        '/auth',     // Page de connexion
        '/public'    // Événements publics
    ];

    // 🔐 Permissions par route
    static ROUTE_PERMISSIONS = {
        '/auth': 'auth',        // Toujours accessible
        '/public': 'public',      // Accessible sans connexion
        '/orga': 'organizer',     // Organisateurs seulement
        '/admin': 'admin'         // Administrateurs seulement
    };

    /**
     * 🔍 Vérifier si l'utilisateur peut accéder à une route
     * @param {string} path - Chemin de la route
     * @returns {boolean} - Autorisation d'accès
     */
    static canAccess(path) {
        console.log('🛡️ Vérification accès route:', path);

        // 1. Routes publiques → toujours OK
        if (this.PUBLIC_ROUTES.includes(path)) {
            console.log('✅ Route publique autorisée');
            return true;
        }

        // 2. Vérifier si utilisateur connecté
        if (!Auth.isAuthenticated()) {
            console.log('🚫 Utilisateur non connecté');
            return false;
        }

        // 3. Vérifier les permissions selon le rôle
        const requiredRole = this.ROUTE_PERMISSIONS[path];
        const userRole = Auth.getCurrentUser()?.role;

        console.log('🎭 Rôle requis:', requiredRole, '/ Rôle utilisateur:', userRole);

        // 4. Admin peut tout faire
        if (userRole === 'admin') {
            console.log('✅ Admin - Accès total');
            return true;
        }

        // 5. Organisateur ne peut aller que sur /orga
        if (userRole === 'organizer' && path === '/orga') {
            console.log('✅ Organisateur - Accès dashboard orga');
            return true;
        }

        // 6. Utilisateur lambda ne peut aller que sur public
        if (!requiredRole || requiredRole === 'public') {
            console.log('✅ Accès public autorisé');
            return true;
        }

        console.log('🚫 Accès refusé');
        return false;
    }

    /**
     * 🧭 Obtenir la route de redirection selon le contexte
     * @param {string} attemptedPath - Route tentée
     * @returns {string} - Route de redirection
     */
    static getRedirectPath(attemptedPath) {
        console.log('🧭 Calcul redirection pour:', attemptedPath);

        // 1. Si pas connecté → vers auth
        if (!Auth.isAuthenticated()) {
            console.log('→ Redirection vers /auth (non connecté)');
            return '/auth';
        }

        // 2. Si tentative d'accès à /auth alors que connecté → vers dashboard
        if (attemptedPath === '/auth') {
            const userRole = Auth.getCurrentUser()?.role;
            const homePage = this.getHomePage(userRole);
            console.log('→ Redirection vers dashboard:', homePage);
            return homePage;
        }

        // 3. Si accès refusé → vers page d'accueil selon rôle
        if (!this.canAccess(attemptedPath)) {
            const userRole = Auth.getCurrentUser()?.role;
            const homePage = this.getHomePage(userRole);
            console.log('→ Redirection vers home:', homePage);
            return homePage;
        }

        // 4. Sinon, autoriser la route
        return attemptedPath;
    }

    /**
     * 🏠 Obtenir la page d'accueil selon le rôle
     * @param {string} role - Rôle de l'utilisateur
     * @returns {string} - Route de la page d'accueil
     */
    static getHomePage(role) {
        switch (role) {
            case 'admin':
                return '/admin';
            case 'organizer':
                return '/orga';
            default:
                return '/public';
        }
    }

    /**
     * 🔍 Vérifier si une route existe
     * @param {string} path - Chemin à vérifier
     * @returns {boolean} - Existence de la route
     */
    static routeExists(path) {
        const knownRoutes = [
            '/auth',
            '/public', 
            '/orga',
            '/admin'
        ];
        return knownRoutes.includes(path);
    }

    /**
     * 🛠️ Debug des permissions
     */
    static debug() {
        console.group('🛡️ RouteGuard Debug');
        console.log('Utilisateur connecté:', Auth.isAuthenticated());
        
        if (Auth.isAuthenticated()) {
            const user = Auth.getCurrentUser();
            console.log('Rôle utilisateur:', user?.role);
            console.log('Email utilisateur:', user?.email);
            
            // Test des permissions pour chaque route
            const routes = ['/auth', '/public', '/orga', '/admin'];
            routes.forEach(route => {
                const canAccess = this.canAccess(route);
                console.log(`${canAccess ? '✅' : '🚫'} ${route}`);
            });
        } else {
            console.log('Aucun utilisateur connecté');
        }
        
        console.groupEnd();
    }

    /**
     * 🎯 Middleware pour vérifier l'accès (appelé par le router)
     * @param {string} path - Route demandée
     * @returns {Object} - Résultat de la vérification
     */
    static guard(path) {
        const canAccess = this.canAccess(path);
        const redirectPath = canAccess ? path : this.getRedirectPath(path);
        
        return {
            allowed: canAccess,
            redirect: redirectPath,
            path: path
        };
    }
}

export default RouteGuard;