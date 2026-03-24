/**
 * 🔐 AUTH SERVICE - Service d'authentification
 * Gestion des connexions, inscriptions et permissions via Supabase
 * Emplacement: /src-v2/services/auth.js
 * ✅ VERSION UNIFIÉE - Service pur sans logique d'affichage
 */

import { supabase } from './supabaseClient.js';
import RoleManager from './roleManager.js';

class Auth {

    static authUnsubscribe = null;

/**
 * Initialiser le service d'authentification
 */
static async init() {
    console.log('🔐 Initialisation du service Auth...');
    
    // Si déjà initialisé, ne pas réinitialiser
    if (this.authUnsubscribe) {
        console.log('ℹ️ Auth déjà initialisé, skip');
        return;
    }
    
    // Restaurer la session si elle existe
    await this.restoreSession();
    
    // Ajouter le listener UNE SEULE FOIS
    this.authUnsubscribe = this.onAuthStateChange((event, session) => {
        console.log(`🔄 Événement auth: ${event}`);
    });
    
    console.log('✅ Service Auth initialisé');
}

/**
 * Cleanup au logout
 */
static async logout() {
    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            console.error('🚫 Erreur de déconnexion:', error.message);
            return { success: false, error: this.translateAuthError(error.message) };
        }
        
        // Nettoyer le listener
        if (this.authUnsubscribe) {
            this.authUnsubscribe();
            this.authUnsubscribe = null;
        }
        
        RoleManager.logout();
        
        console.log('✅ Déconnexion réussie');
        
        return { success: true };
        
    } catch (error) {
        console.error('🔥 Erreur inattendue lors de la déconnexion:', error);
        return {
            success: false,
            error: 'Une erreur inattendue est survenue'
        };
    }
}
    
    /**
     * Se connecter avec email et mot de passe
     */
    static async login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) {
                console.error('🚫 Erreur de connexion:', error.message);
                return { 
                    success: false, 
                    error: this.translateAuthError(error.message) 
                };
            }
            
            if (data.user) {
    const userProfile = await this.fetchUserProfile(data.user.id);
    
    if (userProfile) {
        RoleManager.setCurrentUser({
            id: data.user.id,
            email: data.user.email,
            name: `${userProfile.prenom || ''} ${userProfile.nom || ''}`.trim() || data.user.email,
            role: userProfile.role || RoleManager.ROLES.PUBLIC,
            avatar: userProfile.avatar,
            last_login: new Date().toISOString(),
            establishment_id: userProfile.establishment_id,
            metadata: userProfile
        });
                    
                    console.log('✅ Connexion réussie pour:', userProfile.role);
                    
                    return {
                        success: true,
                        user: data.user,
                        role: userProfile.role,
                        profile: userProfile
                    };
                } else {
                    console.warn('⚠️ Profil utilisateur non trouvé');
                    return {
                        success: false,
                        error: 'Profil utilisateur non trouvé'
                    };
                }
            }
            
            return {
                success: false,
                error: 'Erreur de connexion inconnue'
            };
            
        } catch (error) {
            console.error('💥 Erreur inattendue lors de la connexion:', error);
            return {
                success: false,
                error: 'Une erreur inattendue est survenue'
            };
        }
    }
    
    /**
     * Inscription d'un nouvel utilisateur
     */
    static async register(email, password, metadata = {}) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        name: metadata.name,
                        role: metadata.role,
                        establishment_name: metadata.establishment_name
                    }
                }
            });
            
            if (error) {
                console.error('🚫 Erreur d\'inscription:', error.message);
                return { 
                    success: false, 
                    error: this.translateAuthError(error.message) 
                };
            }
            
            if (data.user) {
                // Créer le profil utilisateur dans la base
                const profileResult = await this.createUserProfile(data.user, metadata);
                
                if (profileResult.success) {
                    console.log('✅ Inscription réussie pour:', metadata.role);
                    
                    return {
                        success: true,
                        user: data.user,
                        needsEmailConfirmation: !data.session,
                        profile: profileResult.profile
                    };
                } else {
                    console.error('🚫 Erreur création profil:', profileResult.error);
                    return {
                        success: false,
                        error: 'Erreur lors de la création du profil'
                    };
                }
            }
            
            return {
                success: false,
                error: 'Erreur d\'inscription inconnue'
            };
            
        } catch (error) {
            console.error('💥 Erreur inattendue lors de l\'inscription:', error);
            return {
                success: false,
                error: 'Une erreur inattendue est survenue'
            };
        }
    }
    
    /**
     * Déconnexion
     */
    static async logout() {
        try {
            const { error } = await supabase.auth.signOut();
            
            if (error) {
                console.error('🚫 Erreur de déconnexion:', error.message);
                return { 
                    success: false, 
                    error: this.translateAuthError(error.message) 
                };
            }
            
            // Nettoyer RoleManager
            RoleManager.logout();
            
            console.log('✅ Déconnexion réussie');
            
            return { success: true };
            
        } catch (error) {
            console.error('💥 Erreur inattendue lors de la déconnexion:', error);
            return {
                success: false,
                error: 'Une erreur inattendue est survenue'
            };
        }
    }
    
    /**
     * Réinitialisation du mot de passe
     */
    static async resetPassword(email) {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth?mode=reset&reset=true`
            });
            
            if (error) {
                console.error('🚫 Erreur reset password:', error.message);
                return { 
                    success: false, 
                    error: this.translateAuthError(error.message) 
                };
            }
            
            console.log('✅ Email de réinitialisation envoyé');
            
            return { success: true };
            
        } catch (error) {
            console.error('💥 Erreur inattendue lors du reset:', error);
            return {
                success: false,
                error: 'Une erreur inattendue est survenue'
            };
        }
    }
    
    /**
     * Vérifier si l'utilisateur est authentifié
     */
    static isAuthenticated() {
        return RoleManager.isAuthenticated();
    }
    
    /**
     * Obtenir l'utilisateur actuel
     */
    static getCurrentUser() {
        return RoleManager.getCurrentUser();
    }
    
    /**
     * Vérifier les permissions
     */
    static hasPermission(permission) {
        return RoleManager.hasPermission(permission);
    }
    
    /**
     * Récupérer le profil utilisateur depuis la base
     */
    static async fetchUserProfile(userId) {
        try {
            const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
                
            if (error) {
                console.error('🚫 Erreur récupération profil:', error.message);
                return null;
            }
            if (!data) {
    console.warn('⚠️ Aucun profil trouvé ou accès refusé pour:', userId);
    return null;
}
            return data;
            
        } catch (error) {
            console.error('💥 Erreur inattendue récupération profil:', error);
            return null;
        }
    }
    
    static async createUserProfile(user, metadata) {
    try {
        const profileData = {
            id: user.id,
            prenom: metadata.prenom || metadata.name?.split(' ')[0] || '',
            nom: metadata.nom || metadata.name?.split(' ')[1] || '',
            role: metadata.role || 'user',
            telephone: metadata.phone || null,
            establishment_id: null
        };
            
            // Si c'est un organisateur, créer aussi l'établissement
            if (metadata.role === RoleManager.ROLES.ORGANIZER && metadata.establishment_name) {
                const establishmentResult = await this.createEstablishment(metadata.establishment_name, user.id);
                if (establishmentResult.success) {
                    profileData.establishment_id = establishmentResult.establishment.id;
                }
            }
            
            const { data, error } = await supabase
    .from('profiles')
                .insert([profileData])
                .select()
                .maybeSingle();
                
            if (error) {
                console.error('🚫 Erreur création profil:', error.message);
                return { 
                    success: false, 
                    error: error.message 
                };
            }
            
            console.log('✅ Profil utilisateur créé');
            
            return {
                success: true,
                profile: data
            };
            
        } catch (error) {
            console.error('💥 Erreur inattendue création profil:', error);
            return {
                success: false,
                error: 'Erreur lors de la création du profil'
            };
        }
    }
    
    /**
     * Créer un établissement pour un organisateur
     */
    static async createEstablishment(name, userId) {
        try {
            const { data, error } = await supabase
                .from('establishments')
                .insert([{
                    name: name,
                    owner_id: userId,
                    created_at: new Date().toISOString()
                }])
                .select()
                .maybeSingle();
                
            if (error) {
                console.error('🚫 Erreur création établissement:', error.message);
                return { 
                    success: false, 
                    error: error.message 
                };
            }
            
            console.log('✅ Établissement créé:', name);
            
            return {
                success: true,
                establishment: data
            };
            
        } catch (error) {
            console.error('💥 Erreur inattendue création établissement:', error);
            return {
                success: false,
                error: 'Erreur lors de la création de l\'établissement'
            };
        }
    }
    
    /**
     * Restaurer la session depuis Supabase
     */
    static async restoreSession() {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) {
                console.error('🚫 Erreur restauration session:', error.message);
                return false;
            }
            
            if (session && session.user) {
    const userProfile = await this.fetchUserProfile(session.user.id);
    
    if (userProfile) {
        RoleManager.setCurrentUser({
            id: session.user.id,
            email: session.user.email,
            name: `${userProfile.prenom || ''} ${userProfile.nom || ''}`.trim() || session.user.email,
            role: userProfile.role || RoleManager.ROLES.PUBLIC,
            avatar: userProfile.avatar,
            last_login: userProfile.last_login,
            establishment_id: userProfile.establishment_id,
            metadata: userProfile
        });
                    
                    console.log('✅ Session restaurée pour:', userProfile.role);
                    return true;
                }
            }
            
            return false;
            
        } catch (error) {
            console.error('💥 Erreur inattendue restauration session:', error);
            return false;
        }
    }
    
    /**
     * Écouter les changements d'authentification
     */
    static onAuthStateChange(callback) {
    let lastSession = null;
    
    return supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('🔄 Changement auth:', event);
        
        // Ignorer les SIGNED_IN redondants (même session)
        if (event === 'SIGNED_IN') {
            if (lastSession?.user?.id === session?.user?.id) {
                console.log('⏭️ SIGNED_IN ignoré (même session)');
                return;
            }
            lastSession = session;
            
            const userProfile = await this.fetchUserProfile(session.user.id);
            if (userProfile) {
                RoleManager.setCurrentUser({
                    id: session.user.id,
                    email: session.user.email,
                    name: `${userProfile.prenom || ''} ${userProfile.nom || ''}`.trim() || session.user.email,
                    role: userProfile.role || RoleManager.ROLES.PUBLIC,
                    avatar: userProfile.avatar,
                    last_login: new Date().toISOString(),
                    establishment_id: userProfile.establishment_id,
                    metadata: userProfile
                });
            }
        } else if (event === 'SIGNED_OUT') {
            lastSession = null;
            RoleManager.logout();
        }
        
        if (callback) {
            callback(event, session);
        }
    });
}
    
    /**
     * Traduire les erreurs d'authentification
     */
    static translateAuthError(errorMessage) {
        const errorMap = {
            'Invalid login credentials': 'Email ou mot de passe incorrect',
            'Email not confirmed': 'Veuillez confirmer votre email avant de vous connecter',
            'User already registered': 'Un compte existe déjà avec cet email',
            'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères',
            'Invalid email': 'Format d\'email invalide',
            'User not found': 'Utilisateur non trouvé',
            'Email rate limit exceeded': 'Trop de tentatives, veuillez réessayer plus tard'
        };
        
        return errorMap[errorMessage] || errorMessage;
    }
    
    /**
     * Initialiser le service d'authentification
     */
    static async init() {
        console.log('🔐 Initialisation du service Auth...');
        
        // Restaurer la session si elle existe
        await this.restoreSession();
        
        // Écouter les changements d'état
        this.onAuthStateChange((event, session) => {
            console.log(`🔄 Événement auth: ${event}`);
        });
        
        console.log('✅ Service Auth initialisé');
    }
    
    /**
     * Obtenir les statistiques d'authentification
     */
    static getStats() {
        const user = this.getCurrentUser();
        const isAuth = this.isAuthenticated();
        
        return {
            authenticated: isAuth,
            user: user ? {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                lastLogin: user.last_login
            } : null,
            session: {
                hasSession: !!supabase.auth.getSession(),
                provider: 'supabase'
            }
        };
    }
}
window.Auth = Auth;
export default Auth;