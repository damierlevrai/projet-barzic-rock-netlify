/**
 * 🗄️ SUPABASE CLIENT - Client de base de données
 * Configuration et connexion Supabase pour Barzik
 */

import { createClient } from '@supabase/supabase-js';

// Configuration Supabase depuis les variables d'environnement
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Vérification de la configuration
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Configuration Supabase manquante:');
    console.error('- VITE_SUPABASE_URL:', !!supabaseUrl);
    console.error('- VITE_SUPABASE_ANON_KEY:', !!supabaseAnonKey);
    throw new Error('Variables d\'environnement Supabase manquantes');
}

// Création du client Supabase
let supabaseInstance;
if (!window.supabaseInstance) {
    window.supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        fetch: (url, options = {}) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s au lieu de 5s
            
            return fetch(url, {
                ...options,
                signal: controller.signal
            }).finally(() => {
                clearTimeout(timeoutId);
            });
        }
    }
});
    console.log('✅ Nouvelle instance Supabase créée');
} else {
    console.log('♻️ Réutilisation instance Supabase existante');
}

export const supabase = window.supabaseInstance;
/**
 * Classe utilitaire pour interactions Supabase
 */
class SupabaseClient {
    
    static client = supabase;
    
    /**
     * Tester la connexion à Supabase
     */
    static async testConnection() {
        try {
            const { count, error } = await supabase
    .from('establishments')
    .select('*', { count: 'exact', head: true })
    .limit(1);
            
            if (error) throw error;
console.log('✅ Connexion Supabase réussie');
return { success: true, count };
            
        } catch (error) {
            console.error('❌ Erreur connexion Supabase:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
    
    /**
     * Obtenir les informations de la base de données
     */
    static async getDatabaseInfo() {
        try {
            const { data: tables, error } = await supabase.rpc('get_table_list');
            
            if (error) throw error;
            
            return {
                success: true,
                tables: tables || []
            };
            
        } catch (error) {
            // Fallback si la fonction RPC n'existe pas
            const knownTables = ['events', 'establishments'];
            
            const tableInfo = await Promise.all(
                knownTables.map(async (table) => {
                    try {
                        const { count, error } = await supabase
                            .from(table)
                            .select('*', { count: 'exact', head: true });
                        
                        return {
                            table_name: table,
                            row_count: error ? 0 : count,
                            accessible: !error
                        };
                    } catch {
                        return {
                            table_name: table,
                            row_count: 0,
                            accessible: false
                        };
                    }
                })
            );
            
            return {
                success: true,
                tables: tableInfo
            };
        }
    }
    
    /**
     * Obtenir les statistiques globales
     */
    static async getGlobalStats() {
        try {
            const stats = {};
            
            // Compter les événements
            const { count: eventCount, error: eventError } = await supabase
                .from('events')
                .select('*', { count: 'exact', head: true });
                
            stats.totalEvents = eventError ? 0 : eventCount;
            
            // Compter les établissements
            const { count: establishmentCount, error: establishmentError } = await supabase
                .from('establishments')
                .select('*', { count: 'exact', head: true });
                
            stats.totalEstablishments = establishmentError ? 0 : establishmentCount;
            
            // Événements à venir
            const today = new Date().toISOString().split('T')[0];
            const { count: upcomingCount, error: upcomingError } = await supabase
                .from('events')
                .select('*', { count: 'exact', head: true })
                .gte('event_date', today);
                
            stats.upcomingEvents = upcomingError ? 0 : upcomingCount;
            
            return {
                success: true,
                stats
            };
            
        } catch (error) {
            console.error('Erreur récupération statistiques:', error);
            return {
                success: false,
                error: error.message,
                stats: {
                    totalEvents: 0,
                    totalEstablishments: 0,
                    upcomingEvents: 0
                }
            };
        }
    }
    
    /**
     * Vérifier l'état de la session utilisateur
     */
    static async getSessionInfo() {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            return {
                success: true,
                session,
                isAuthenticated: !!session,
                user: session?.user || null
            };
            
        } catch (error) {
            console.error('Erreur récupération session:', error);
            return {
                success: false,
                error: error.message,
                isAuthenticated: false,
                user: null
            };
        }
    }
    
    /**
     * Utilitaire pour logs d'erreur formatés
     */
    static logError(operation, error) {
        console.group(`❌ Erreur Supabase - ${operation}`);
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        console.error('Details:', error.details);
        console.error('Hint:', error.hint);
        console.groupEnd();
    }
    
    /**
     * Utilitaire pour formater les erreurs Supabase
     */
    static formatError(error) {
        // Erreurs communes Supabase avec messages utilisateur-friendly
        const errorMessages = {
            'PGRST116': 'Aucun résultat trouvé',
            'PGRST301': 'Permissions insuffisantes',
            'PGRST204': 'Conflit de données',
            '23505': 'Cette donnée existe déjà',
            '23503': 'Référence invalide',
            'PGRST000': 'Erreur de serveur',
            'auth/user-not-found': 'Utilisateur non trouvé',
            'auth/invalid-password': 'Mot de passe incorrect',
            'auth/email-already-in-use': 'Email déjà utilisé',
            'auth/weak-password': 'Mot de passe trop faible'
        };
        
        return errorMessages[error.code] || 
               errorMessages[error.error_code] || 
               error.message || 
               'Erreur inconnue';
    }
    
    /**
     * Wrapper pour requêtes avec gestion d'erreur automatique
     */
    static async executeQuery(queryName, queryFn) {
        try {
            console.log(`🔄 Exécution: ${queryName}`);
            //const result = await queryFn();
            
            if (result.error) {
                this.logError(queryName, result.error);
                return {
                    success: false,
                    error: this.formatError(result.error)
                };
            }
            
            console.log(`✅ Succès: ${queryName}`);
            return {
                success: true,
                data: result.data
            };
            
        } catch (error) {
            this.logError(queryName, error);
            return {
                success: false,
                error: this.formatError(error)
            };
        }
    }
    
    
}

// Initialisation automatique et test de connexion au chargement
document.addEventListener('DOMContentLoaded', async () => {
    const connectionTest = await SupabaseClient.testConnection();
    if (!connectionTest.success) {
        
    }
});

window.SupabaseClient = SupabaseClient;
export { SupabaseClient };
export default supabase;