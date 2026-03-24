/**
 * 📋 SYNC QUEUE - Queue persistante de synchronisation
 * 
 * Stocke les opérations à syncer (approve, reject, upload)
 * Les retraite au redémarrage si non-syncées
 * Retry automatique avec backoff exponentiel
 */

import IndexedDBManager from '../IndexedDBManager.js';
import NetworkStatus from './NetworkStatus.js';

class SyncQueue {
  static queueStore = 'sync_queue';
  static maxRetries = 5;
  static isProcessing = false;

  /**
   * 🚀 Initialisation de la queue
   */
  static async init() {
  console.log('📋 SyncQueue initialisation...');
  
  await this.ensureQueueStore();

  // 🌐 Écouter les changements réseau
  NetworkStatus.onStatusChange((isOnline) => {
    if (isOnline) {
      console.log('🌐 Réseau rétabli - traitement queue...');
      this.processQueue(); // Sans await - lancer en BG
    }
  });

  // Traiter les items en attente au démarrage
  await this.processQueue();

  console.log('✅ SyncQueue prête');
}
  /**
   * 📦 Ajouter un item à la queue
   * @param {string} type - 'establishment' ou 'event'
   * @param {string} id - ID de l'item
   * @param {string} action - 'approve', 'reject', 'upload', etc.
   * @param {Object} data - Données à syncer
   * @param {string} priority - 'high', 'normal', 'low'
   */
  static async add(type, id, action, data = {}, priority = 'normal') {
    const queueId = `${type}_${id}_${action}_${Date.now()}`;

    const item = {
      id: queueId,
      type,
      itemId: id,
      action,
      data,
      status: 'pending',
      priority,
      retries: 0,
      maxRetries: this.maxRetries,
      nextRetry: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      error: null
    };

    try {
      await IndexedDBManager.put(this.queueStore, item);
      console.log(`📋 Item ajouté à queue: ${action} ${id.substring(0, 8)}`);
      return queueId;
    } catch (error) {
      console.error('❌ Erreur ajout queue:', error);
      throw error;
    }
  }

  /**
   * 🔄 Traiter la queue
   */
  static async processQueue() {    
    if (this.isProcessing) {
      console.log('⏳ Queue déjà en traitement...');
      return;
    }

    if (NetworkStatus.isOffline()) {
      console.log('⚠️ Offline - queue en attente');
      return;
    }

    this.isProcessing = true;

    try {
      const pendingItems = await this.getPendingItems();

if (pendingItems.length === 0) {
  console.log('✅ Queue vide');
  return;
}

// Limiter à 10 items par batch pour éviter blocking
const MAX_BATCH_SIZE = 10;
const itemsToProcess = pendingItems.slice(0, MAX_BATCH_SIZE);  // ← AJOUTER CETTE LIGNE

console.log(`📋 Traitement ${itemsToProcess.length}/${pendingItems.length} item(s)...`);

// Trier par priorité + date
itemsToProcess.sort((a, b) => {  // ← CHANGER pendingItems en itemsToProcess
  const priorityOrder = { high: 0, normal: 1, low: 2 };
  const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
  return pDiff !== 0 ? pDiff : a.createdAt - b.createdAt;
});

for (const item of itemsToProcess) {  // ← CHANGER pendingItems en itemsToProcess
  // Vérifier si retry est autorisé
  if (item.nextRetry > Date.now()) {
    console.log(`⏳ Retry trop tôt pour: ${item.id.substring(0, 8)}`);
    continue;
  }

  try {
    await this.processItem(item);
  } catch (error) {
    console.error(`❌ Erreur traitement item:`, error);
    await this.handleRetry(item, error);
  }
}

    } catch (error) {
      console.error('❌ Erreur processQueue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * ⚙️ Traiter un item spécifique
   */
  static async processItem(item) {
  console.log(`🔄 Traitement: ${item.action} ${item.itemId.substring(0, 8)}`);

  const handler = this.getActionHandler(item.action);
  if (!handler) {
    throw new Error(`Action non supportée: ${item.action}`);
  }

  // Wrapper avec timeout (30s)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const result = await Promise.race([
      handler(item.type, item.itemId, item.data),
      new Promise((_, reject) =>
        controller.signal.addEventListener('abort', () => 
          reject(new Error('Handler timeout (30s)'))
        )
      )
    ]);

    item.status = 'completed';
    item.updatedAt = Date.now();
    await IndexedDBManager.put(this.queueStore, item);

    console.log(`✅ Complété: ${item.id.substring(0, 8)}`);

    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

  /**
   * 🔄 Gérer les retries
   */
  static async handleRetry(item, error) {
    item.retries++;
    item.error = error.message;
    item.updatedAt = Date.now();

    if (item.retries >= item.maxRetries) {
      // Trop de retries - marqué comme failed
      item.status = 'failed';
      console.log(`❌ Item échoué après ${item.maxRetries} retries: ${item.id.substring(0, 8)}`);
      
      // Notifier l'app
      window.dispatchEvent(new CustomEvent('syncQueueFailed', {
        detail: { item, error }
      }));
    } else {
      // Calculer prochain retry avec backoff exponentiel
      const delaySeconds = Math.pow(2, item.retries); // 2s, 4s, 8s, 16s, 32s
      item.nextRetry = Date.now() + (delaySeconds * 1000);
      item.status = 'pending';
      console.log(`⏳ Retry ${item.retries}/${item.maxRetries} dans ${delaySeconds}s`);
    }

    await IndexedDBManager.put(this.queueStore, item);
  }

  /**
   * 📝 Récupérer les items en attente
   */
  static async getPendingItems() {
    try {
      const allItems = await IndexedDBManager.getAll(this.queueStore);
      return allItems.filter(item => item.status === 'pending');
    } catch (error) {
      console.error('❌ Erreur getPendingItems:', error);
      return [];
    }
  }

  /**
   * 🎯 Récupérer le handler pour une action
   */
  static getActionHandler(action) {
    const handlers = {
      'approve': this.handleApprove.bind(this),
      'reject': this.handleReject.bind(this),
      'upload': this.handleUpload.bind(this),
      'geocode': this.handleGeocode.bind(this),
      'photo-upload': this.handlePhotoUpload.bind(this)
    };

    return handlers[action] || null;
  }

  /**
   * ✅ Handler: Approve
   */
  static async handleApprove(type, id, data) {
    if (!window.supabaseInstance) {
      throw new Error('Supabase non disponible');
    }

    const table = type === 'events' ? 'event' : 'establishment';
    const supabaseData = {
      id,
      status: 'approved',
      updated_at: new Date().toISOString(),
      ...data
    };

    const { error } = await window.supabaseInstance
      .from(table)
      .upsert(supabaseData, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Approuvé sur Supabase: ${id.substring(0, 8)}`);
  }

  /**
   * ❌ Handler: Reject
   */
  static async handleReject(type, id, data) {
    if (!window.supabaseInstance) {
      throw new Error('Supabase non disponible');
    }

    const table = type === 'events' ? 'event' : 'establishment';

    const { error } = await window.supabaseInstance
      .from(table)
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log(`❌ Rejeté (supprimé) de Supabase: ${id.substring(0, 8)}`);
  }

  /**
   * 📤 Handler: Upload
   */
  static async handleUpload(type, id, data) {
    if (!window.supabaseInstance) {
      throw new Error('Supabase non disponible');
    }

    const table = type === 'events' ? 'event' : 'establishment';

    const { error } = await window.supabaseInstance
      .from(table)
      .upsert(data, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    console.log(`📤 Uploadé vers Supabase: ${id.substring(0, 8)}`);
  }

  /**
   * 🗺️ Handler: Geocode (optionnel)
   */
  static async handleGeocode(type, id, data) {
    // À implémenter si nécessaire
    console.log(`🗺️ Geocoding: ${id.substring(0, 8)}`);
  }

  /**
   * 🖼️ Handler: Photo Upload
   */
  static async handlePhotoUpload(type, id, data) {
    // À implémenter si nécessaire
    console.log(`🖼️ Photo upload: ${id.substring(0, 8)}`);
  }

  /**
   * 📊 Statut de la queue
   */
  static async getStatus() {
    const all = await IndexedDBManager.getAll(this.queueStore);
    return {
      total: all.length,
      pending: all.filter(i => i.status === 'pending').length,
      completed: all.filter(i => i.status === 'completed').length,
      failed: all.filter(i => i.status === 'failed').length
    };
  }

  /**
   * 🧹 Créer le store s'il n'existe pas (migration IndexedDB)
   */
  static async ensureQueueStore() {
    try {
      await IndexedDBManager.init();
      // Le store sera créé lors de l'upgrade IndexedDB (v3)
    } catch (error) {
      console.warn('⚠️ Erreur ensureQueueStore:', error);
    }
  }

  /**
   * 🎯 Vérifier si il y a des items en attente
   */
  static async hasPendingItems() {
    const pending = await this.getPendingItems();
    return pending.length > 0;
  }

  /**
   * 🗑️ Nettoyer les items complétés (optionnel)
   */
  static async cleanup() {
    try {
      const allItems = await IndexedDBManager.getAll(this.queueStore);
      const completedItems = allItems.filter(i => i.status === 'completed');

      for (const item of completedItems) {
        await IndexedDBManager.delete(this.queueStore, item.id);
      }

      console.log(`🧹 ${completedItems.length} item(s) nettoyé(s)`);
    } catch (error) {
      console.error('❌ Erreur cleanup:', error);
    }
  }
}

// Auto-init
if (typeof window !== 'undefined') {
  window.SyncQueue = SyncQueue;
  document.addEventListener('DOMContentLoaded', async () => {
    await SyncQueue.init();
  });
}

export default SyncQueue;