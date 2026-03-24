/**
 * 🎯 SYNC ORCHESTRATOR - Point centralisé de synchronisation
 * Coordonne SyncEngine, Realtime, Queue
 * Évite les race conditions et les multiples syncs parallèles
 */

class SyncOrchestrator {
  static isSyncing = false;
  static syncQueue = [];
  static pendingRealtimeChanges = [];
  static lastSyncTime = 0;
  static MIN_SYNC_INTERVAL = 3000;  // Min 3s entre syncs
  static syncTimeout = null;

  /**
   * 🎯 INIT - Initialiser l'orchestrateur
   */
  static async init() {
    console.log('🎯 SyncOrchestrator init...');
    
    // Écouter les changements réseau
    if (window.NetworkStatus) {
      window.NetworkStatus.onStatusChange((isOnline) => {
        if (isOnline) {
          console.log('🌐 App online - triggering sync...');
          this.scheduleSync('network-restored', 1000);
        }
      });
    }
    
    console.log('✅ SyncOrchestrator ready');
  }

  /**
   * 📡 ON REALTIME CHANGE - Notifications Realtime accumulées
   */
  static onRealtimeChange(data) {
    console.log('📡 Realtime change:', data);
    
    // Accumuler plutôt que syncer immédiatement
    this.pendingRealtimeChanges.push({
      ...data,
      timestamp: Date.now()
    });
    
    // Scheduler sync avec debounce
    this.scheduleSync('realtime', 500);  // Attendre 500ms pour accumuler
  }

  /**
   * ⏰ SCHEDULE SYNC - Avec debounce et rate limiting
   */
  static scheduleSync(trigger, delayMs = 0) {
    const now = Date.now();
    const timeSinceLastSync = now - this.lastSyncTime;
    
    if (timeSinceLastSync < this.MIN_SYNC_INTERVAL) {
      const waitTime = this.MIN_SYNC_INTERVAL - timeSinceLastSync;
      console.log(`⏰ Wait ${waitTime}ms before sync`);
      delayMs = Math.max(delayMs, waitTime);
    }
    
    if (this.isSyncing) {
      console.log('⏳ Sync already in progress, marking as pending');
      this.syncQueue.push({ trigger, delayMs, timestamp: now });
      return;
    }

    // Annuler timeout précédent
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    console.log(`⏰ Scheduling sync in ${delayMs}ms (trigger: ${trigger})`);
    
    this.syncTimeout = setTimeout(() => {
      this.performSync(trigger);
    }, delayMs);
  }

  /**
   * 🔄 PERFORM SYNC - Vraie synchronisation
   */
  static async performSync(trigger) {
    if (this.isSyncing) {
      console.log('⏳ Already syncing...');
      return;
    }
    
    this.isSyncing = true;
    this.lastSyncTime = Date.now();

    try {
      const user = window.Auth?.getCurrentUser();
      if (!user) throw new Error('User not connected');
      
      console.log(`🔄 SYNC ORCHESTRATION START: trigger=${trigger}, user=${user.role}`);

      // STEP 1: Traiter queue SyncQueue items (moderation admin)
      if (window.SyncQueue?.hasPendingItems?.()) {
        console.log('📋 Processing SyncQueue items...');
        try {
          await window.SyncQueue.processQueue();
        } catch (queueError) {
          console.error('⚠️ SyncQueue error:', queueError);
          // Continue quand même, ne pas bloquer
        }
      }

      // STEP 2: Main sync (SyncEngine)
      if (window.SyncEngine) {
        console.log('🔄 Running SyncEngine...');
        const syncResult = await window.SyncEngine.syncAll(
          user.role, 
          user.id, 
          false
        );

        if (!syncResult?.success) {
          throw new Error(syncResult?.error || 'Sync failed');
        }
      }

      // STEP 3: Notifier UI des changements Realtime
      if (this.pendingRealtimeChanges.length > 0) {
        console.log(`📢 Broadcasting ${this.pendingRealtimeChanges.length} changes`);
        this.pendingRealtimeChanges.forEach(change => {
          window.dispatchEvent(new CustomEvent('syncCompleted', {
            detail: change
          }));
        });
        this.pendingRealtimeChanges = [];
      }

      console.log('✅ Sync orchestration completed');
      
      // Dispatcher event global
      window.dispatchEvent(new CustomEvent('orchestratorSyncCompleted', {
        detail: { trigger, timestamp: new Date().toISOString() }
      }));

    } catch (error) {
      console.error('❌ Orchestration error:', error);
      window.dispatchEvent(new CustomEvent('orchestratorSyncFailed', {
        detail: { error: error.message, trigger }
      }));
    } finally {
      this.isSyncing = false;

      // Relancer s'il y a des items en queue
      if (this.syncQueue.length > 0) {
        const next = this.syncQueue.shift();
        console.log(`🔄 Relancer sync (${this.syncQueue.length} restant)`);
        this.scheduleSync(next.trigger, next.delayMs);
      }
    }
  }

  /**
   * 📊 GET STATUS - État actuel
   */
  static getStatus() {
    return {
      isSyncing: this.isSyncing,
      queueLength: this.syncQueue.length,
      pendingRealtimeChanges: this.pendingRealtimeChanges.length,
      lastSyncTime: new Date(this.lastSyncTime).toLocaleTimeString('fr-FR'),
      timeSinceLastSync: Date.now() - this.lastSyncTime
    };
  }

  /**
   * 🛑 STOP - Arrêter l'orchestrateur
   */
  static stop() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.isSyncing = false;
    console.log('🛑 SyncOrchestrator stopped');
  }
}

// Auto-init et export
if (typeof window !== 'undefined') {
  window.SyncOrchestrator = SyncOrchestrator;
  document.addEventListener('DOMContentLoaded', () => {
    SyncOrchestrator.init();
  });
}

export default SyncOrchestrator;