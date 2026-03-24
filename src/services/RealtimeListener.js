/**
 * 🔔 REALTIME LISTENER - Écoute notifications Supabase
 * 
 * Notifications simples + toast
 * SyncOrchestrator gère la sync auto
 */

import SyncOrchestrator from '../services/SyncOrchestrator.js';
import IndexedDBManager from '../services/IndexedDBManager.js';
import Auth from '../services/auth.js';

class RealtimeListener {
  static subscriptions = [];

  static async initializeRealtime() {
    console.log('🔔 RealtimeListener initialisation...');
    
    const userRole = Auth.getCurrentUser()?.role;

    // ADMIN : écouter les INSERTS/UPDATES pending
    if (userRole === 'admin') {
      this.subscribeToTable('establishments', 'INSERT', (payload) => {
        if (payload.new.status === 'pending') {
          this.notifyAdminNewPending('establishments', payload.new);
        }
      });

      this.subscribeToTable('establishments', 'UPDATE', (payload) => {
        if (payload.new.status === 'pending' && payload.old.status !== 'pending') {
          this.notifyAdminNewPending('establishments', payload.new);
        }
      });

      this.subscribeToTable('events', 'INSERT', (payload) => {
        if (payload.new.status === 'pending') {
          this.notifyAdminNewPending('events', payload.new);
        }
      });

      this.subscribeToTable('events', 'UPDATE', (payload) => {
        if (payload.new.status === 'pending' && payload.old.status !== 'pending') {
          this.notifyAdminNewPending('events', payload.new);
        }
      });

      this.subscribeToTable('profiles', 'INSERT', (payload) => {
        this.notifyAdminNewProfile(payload.new);
      });
    }

    // ORGA : écouter les UPDATES où status = approved (ses items uniquement)
    if (userRole === 'organizer') {
      const userId = Auth.getCurrentUser()?.id;

      this.subscribeToTable('establishments', 'UPDATE', (payload) => {
        if (payload.new.owner_id === userId && 
            payload.new.status === 'approved' && 
            payload.old.status === 'pending') {
          this.notifyOrgaApproval('establishments', payload.new);
        }
      });

      this.subscribeToTable('events', 'UPDATE', (payload) => {
        if (payload.new.owner_id === userId && 
            payload.new.status === 'approved' && 
            payload.old.status === 'pending') {
          this.notifyOrgaApproval('events', payload.new);
        }
      });

      // ORGA : écouter les REJECTIONS (deletion par Admin)
      this.subscribeToTable('events', 'DELETE', (payload) => {
        if (payload.old.owner_id === userId) {
          this.notifyOrgaRejection('events', payload.old);
        }
      });

      this.subscribeToTable('establishments', 'DELETE', (payload) => {
        if (payload.old.owner_id === userId) {
          this.notifyOrgaRejection('establishments', payload.old);
        }
      });
    }

    // PUBLIC : rien
  }

  static subscribeToTable(tableName, eventType, callback) {
  try {
    const channel = window.supabaseInstance
      .channel(`${tableName}:${eventType}`)
      .on(
        'postgres_changes',
        {
          event: eventType,
          schema: 'public',
          table: tableName
        },
        callback
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to ${tableName}:${eventType}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Channel error: ${tableName}:${eventType}`);
        } else if (status === 'TIMED_OUT') {
          console.warn(`⚠️ Channel timeout: ${tableName}:${eventType}`);
        }
      });

    this.subscriptions.push(channel);
  } catch (error) {
    console.error(`❌ Failed to subscribe to ${tableName}:${eventType}:`, error.message);
    // Continuer sans ce channel, l'app fonctionne quand même
  }
}

  /**
   * ✅ ORGA APPROVAL - Item approuvé par Admin
   */
  static notifyOrgaApproval(type, item) {
    const message = type === 'establishment' 
      ? `Établissement "${item.nom}" approuvé !`
      : `Événement "${item.titre}" approuvé !`;

    console.log('✅ Orga approval notification:', message);

    if (window.BarzikToast) {
      window.BarzikToast.show(message, 'success');
    }

    // Mettre à jour IndexedDB
    const storeName = type === 'establishment' ? 'establishments' : 'events';
    IndexedDBManager.put(storeName, item);

    // Déclencher auto-sync
    if (window.SyncOrchestrator) {
  window.SyncOrchestrator.onRealtimeChange({
    type: 'approval',
    itemType: type,
    item,
    user_role: 'organizer'
  });
}
  }

  /// ORGA REJECTION
static async notifyOrgaRejection(type, item) {
  const message = type === 'establishment' 
    ? `Établissement "${item.nom}" a été rejeté`
    : `Événement "${item.titre}" a été rejeté`;

  console.log('❌ Orga rejection notification:', message);

  if (window.BarzikToast) {
    window.BarzikToast.show(message, 'warning');
  }

  try {
    // Supprimer de IndexedDB
    const storeName = type === 'establishment' ? 'establishments' : 'events';
    await IndexedDBManager.delete(storeName, item.id);

    // Supprimer les photos associées du cache
    if (item.photo_id) {
      try {
        await IndexedDBManager.delete('photos', item.photo_id);
        console.log(`🗑️ Photo IndexedDB supprimée: ${item.photo_id.substring(0, 8)}`);
      } catch (photoError) {
        console.warn('⚠️ Erreur suppression photo IndexedDB:', photoError.message);
      }
    }

    // Invalider cache du tab correspondant
    if (window.TabCacheManager) {
      const tabName = type === 'establishment' ? 'establishments' : 'events';
      window.TabCacheManager.invalidate(tabName);
    }

    // Déclencher sync pour refresh UI
    if (window.SyncOrchestrator) {
      window.SyncOrchestrator.onRealtimeChange('rejection', {
        type,
        item,
        user_role: 'organizer'
      });
    }
  } catch (error) {
    console.error('❌ Erreur notifyOrgaRejection:', error.message);
  }
}

  /**
   * ℹ️ ADMIN NEW PENDING - Nouvel item à modérer
   */
  static notifyAdminNewPending(type, item) {
    const message = type === 'establishment'
      ? `Nouvel établissement en attente: ${item.nom}`
      : type === 'event'
      ? `Nouvel événement en attente: ${item.titre}`
      : '';

    console.log('ℹ️ Admin new pending:', message);

    if (message && window.BarzikToast) {
      window.BarzikToast.show(message, 'info');
    }

    // Mettre à jour IndexedDB
    if (type !== 'profile') {
      const storeName = type === 'establishment' ? 'establishments' : 'events';
      IndexedDBManager.put(storeName, item);
    }

    // Invalider cache moderation
    if (window.TabCacheManager) {
      window.TabCacheManager.invalidate('moderation');
    }

    // Déclencher auto-sync
    if (window.SyncOrchestrator) {
      window.SyncOrchestrator.onRealtimeChange('new_pending', {
        type,
        item,
        user_role: 'admin'
      });
    }
  }

  /**
   * 👤 ADMIN NEW PROFILE - Nouveau compte créé
   */
  static notifyAdminNewProfile(profile) {
    const message = `Nouveau compte : ${profile.prenom} ${profile.nom} (${profile.role})`;

    console.log('👤 Admin new profile:', message);

    if (window.BarzikToast) {
      window.BarzikToast.show(message, 'info');
    }

    // Invalider cache accounts
    if (window.TabCacheManager) {
      window.TabCacheManager.invalidate('accounts');
    }
  }

  static unsubscribeAll() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    console.log('🔌 Unsubscribed from all Realtime channels');
  }
}

if (typeof window !== 'undefined') {
  window.RealtimeListener = RealtimeListener;
}

export default RealtimeListener;