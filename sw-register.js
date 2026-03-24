/**
 * 🎸 BARZIK - Enregistrement du Service Worker
 * À inclure dans index.html avant le script main.js
 */

(function() {
  'use strict';
  
  // Vérifier support Service Worker
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Workers non supportés dans ce navigateur');
    return;
  }
  
  // Attendre que la page soit chargée
  window.addEventListener('load', async () => {
    try {
      console.log('[PWA] Enregistrement du Service Worker...');
      
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });
      
      console.log('[PWA] Service Worker enregistré:', registration.scope);
      
      // Écouter les mises à jour
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('[PWA] Nouvelle version du Service Worker détectée');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Nouvelle version disponible
            console.log('[PWA] Nouvelle version disponible');
            
            // Notifier l'utilisateur (optionnel)
            if (window.BarzikToast) {
              window.BarzikToast.info(
                'Nouvelle version disponible ! Rechargez la page pour mettre à jour.',
                {
                  duration: 10000,
                  action: {
                    text: 'Recharger',
                    callback: () => {
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                      window.location.reload();
                    }
                  }
                }
              );
            }
          }
        });
      });
      
      // Vérifier les mises à jour toutes les heures
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
      
    } catch (error) {
      console.error('[PWA] Erreur enregistrement Service Worker:', error);
    }
  });
  
  // Écouter les changements de contrôleur
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[PWA] Service Worker mis à jour');
    
    // Recharger automatiquement après mise à jour
    if (window.confirm('Une nouvelle version de Barzik est disponible. Recharger maintenant ?')) {
      window.location.reload();
    }
  });
  
  // Gérer l'installation de la PWA
  let deferredPrompt;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    // Empêcher l'affichage automatique
    e.preventDefault();
    deferredPrompt = e;
    
    console.log('[PWA] Invitation d\'installation disponible');
    
    // Afficher un bouton d'installation personnalisé (optionnel)
    if (window.BarzikToast) {
      window.BarzikToast.info(
        'Barzik peut être installé sur votre appareil !',
        {
          duration: 8000,
          action: {
            text: 'Installer',
            callback: async () => {
              if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log('[PWA] Choix installation:', outcome);
                deferredPrompt = null;
              }
            }
          }
        }
      );
    }
  });
  
  // Confirmer l'installation
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] Application installée avec succès');
    deferredPrompt = null;
    
    if (window.BarzikToast) {
      window.BarzikToast.success('Barzik installé ! Vous pouvez maintenant y accéder depuis votre écran d\'accueil.');
    }
  });
  
  // Fonction utilitaire pour vider le cache (debug)
  window.clearAppCache = async function() {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      for (const registration of registrations) {
        await registration.unregister();
      }
      
      const cacheNames = await caches.keys();
      
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
      
      console.log('[PWA] Cache et Service Worker vidés');
      window.location.reload();
    }
  };
  
  // État de connexion
  window.addEventListener('online', () => {
    console.log('[PWA] Connexion rétablie');
    
    if (window.BarzikToast) {
      window.BarzikToast.success('Connexion rétablie');
    }
  });
  
  window.addEventListener('offline', () => {
    console.log('[PWA] Mode hors-ligne activé');
    
    if (window.BarzikToast) {
      window.BarzikToast.warning('Mode hors-ligne - Les données locales sont disponibles');
    }
  });
  
})();