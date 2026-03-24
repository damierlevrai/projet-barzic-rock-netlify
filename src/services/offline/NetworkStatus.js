/**
 * 🌐 NETWORK STATUS - Détection online/offline
 * 
 * Émet des events globaux quand le statut change
 * Permet à l'app de réagir aux changements réseau
 */

class NetworkStatus {
  static online = navigator.onLine;
  static listeners = [];

  /**
   * 🚀 Initialisation
   */
  static init() {
    console.log('🌐 NetworkStatus init...');
    
    window.addEventListener('online', () => {
      this.setOnline(true);
    });

    window.addEventListener('offline', () => {
      this.setOnline(false);
    });

    // Statut initial
    console.log(`🌐 Statut initial: ${this.online ? 'ONLINE' : 'OFFLINE'}`);
  }

  /**
   * 📡 Changer le statut
   */
  static setOnline(status) {
    const changed = this.online !== status;
    this.online = status;

    if (changed) {
      console.log(`🌐 Réseau: ${status ? '✅ ONLINE' : '⚠️ OFFLINE'}`);
      this.notifyListeners(status);
      this.dispatchGlobalEvent(status);
    }
  }

  /**
   * 👂 S'abonner aux changements
   */
  static onStatusChange(callback) {
    if (typeof callback !== 'function') return;
    this.listeners.push(callback);
  }

  /**
   * 📢 Notifier les listeners
   */
  static notifyListeners(status) {
    this.listeners.forEach(cb => {
      try {
        cb(status);
      } catch (error) {
        console.error('Erreur listener NetworkStatus:', error);
      }
    });
  }

  /**
   * 🎯 Event global pour l'app entière
   */
  static dispatchGlobalEvent(status) {
    window.dispatchEvent(new CustomEvent('networkStatusChange', {
      detail: { online: status }
    }));

    // Aussi dispatcher des events spécifiques
    if (status) {
      window.dispatchEvent(new CustomEvent('appOnline'));
    } else {
      window.dispatchEvent(new CustomEvent('appOffline'));
    }
  }

  /**
   * ❓ Vérifier le statut
   */
  static isOnline() {
    return this.online;
  }

  static isOffline() {
    return !this.online;
  }

  /**
   * 🔍 Tester la connexion (optionnel, plus précis que navigator.onLine)
   */
  static async testConnection() {
  try {
    // Utiliser une URL locale/fiable plutôt que Google
    // Tester un endpoint local ou Supabase
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    try {
      const response = await fetch('https://www.supabase.co', {
        method: 'HEAD',
        cache: 'no-store',
        mode: 'no-cors',
        signal: controller.signal
      });
      return true; // Si Supabase répond, on est online
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.warn('⚠️ Connection test failed:', error.message);
    return false;
  }
}
}

// Auto-init
if (typeof window !== 'undefined') {
  window.NetworkStatus = NetworkStatus;
  document.addEventListener('DOMContentLoaded', () => {
    NetworkStatus.init();
  });
}

export default NetworkStatus;