/**
 * 🔄 REALTIME SYNC MANAGER - Auto-sync on Realtime notifications
 * 
 * Écoute les notifications de RealtimeListener
 * Déclenche SyncEngine avec backoff intelligent
 * Gère les multiples notifications d'affilée
 */

class SyncOrchestrator {
  static isSyncing = false;
  static pendingSync = false;
  static lastSyncTime = 0;
  static syncDelay = 3000; // 3s entre notifications
  static syncTimeout = null;

  /**
   * 🚀 INIT - Initialiser le manager
   */
  static async init() {
    console.log('🔄 SyncOrchestrator initialisation...');
    
    // Aucune subscription ici
    // RealtimeListener appelle onRealtimeChange() quand events arrivent
    
    console.log('✅ SyncOrchestrator prêt');
  }

  /**
   * 📢 ON REALTIME CHANGE - Appelé par RealtimeListener
   * @param {string} changeType - 'approval', 'new_pending', 'rejection', etc
   * @param {Object} data - { type, item, user_role }
   */
  static onRealtimeChange(changeType, data) {
    console.log(`🔄 RealtimeChange: ${changeType}`, data);

    // Si déjà en train de syncer, marquer comme "pending"
    if (this.isSyncing) {
      console.log('⏳ Sync en cours, marquer comme pending');
      this.pendingSync = true;
      return;
    }

    // Si sync récente (< 3s), attendre avant de relancer
    const timeSinceLastSync = Date.now() - this.lastSyncTime;
    if (timeSinceLastSync < this.syncDelay) {
      console.log(`⏳ Attendre ${this.syncDelay - timeSinceLastSync}ms avant sync`);
      this.scheduleSyncWithBackoff();
      return;
    }

    // Sinon, lancer sync immédiatement
    this.triggerSync(changeType, data);
  }

  /**
   * 🎯 TRIGGER SYNC - Lancer sync immédiatement
   */
  static async triggerSync(changeType, data) {
    if (this.isSyncing) {
      console.log('⏳ Sync déjà en cours');
      this.pendingSync = true;
      return;
    }

    this.isSyncing = true;
    this.lastSyncTime = Date.now();

    try {
      const userRole = window.Auth?.getCurrentUser()?.role;
      const userId = window.Auth?.getCurrentUser()?.id;

      if (!window.SyncEngine) {
        console.error('❌ SyncEngine non disponible');
        this.isSyncing = false;
        return;
      }

      console.log(`🔄 Sync triggered by: ${changeType}`);

      // Wrapper avec timeout (5s)
      const syncPromise = (async () => {
        if (userRole === 'admin') {
          await window.SyncEngine.syncAdminData(userId, false);
        } else if (userRole === 'organizer') {
          await window.SyncEngine.syncOrganizerData(userId, false);
        } else if (userRole === 'public') {
          await window.SyncEngine.syncPublicData(false);
        }
      })();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sync timeout (5s)')), 5000)
      );

      await Promise.race([syncPromise, timeoutPromise]);

      console.log('✅ Sync complétée');

      // Si pending sync en arrière, relancer
      if (this.pendingSync) {
        this.pendingSync = false;
        console.log('🔄 Relancer sync (pending)');
        setTimeout(() => this.onRealtimeChange('pending_retry', {}), 500);
      }

    } catch (error) {
      console.error('❌ Sync error:', error.message);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * ⏰ SCHEDULE SYNC WITH BACKOFF - Attendre avant de syncer
   */
  static scheduleSyncWithBackoff() {
    // Annuler le timeout précédent
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    const timeSinceLastSync = Date.now() - this.lastSyncTime;
    const delay = Math.max(0, this.syncDelay - timeSinceLastSync);

    console.log(`⏰ Scheduling sync dans ${delay}ms`);

    this.syncTimeout = setTimeout(() => {
      this.triggerSync('scheduled', {});
    }, delay);
  }

  /**
   * 🛑 STOP - Arrêter le manager
   */
  static stop() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.isSyncing = false;
    this.pendingSync = false;
    console.log('🛑 SyncOrchestrator arrêté');
  }

  /**
   * 📊 GET STATUS - État actuel
   */
  static getStatus() {
    return {
      isSyncing: this.isSyncing,
      pendingSync: this.pendingSync,
      lastSyncTime: new Date(this.lastSyncTime).toLocaleTimeString('fr-FR'),
      syncDelay: this.syncDelay
    };
  }
}

// Export global
if (typeof window !== 'undefined') {
  window.SyncOrchestrator = SyncOrchestrator;
}

export default SyncOrchestrator;