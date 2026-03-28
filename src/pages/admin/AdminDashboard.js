/**
 * 🎛️ ADMIN DASHBOARD - Orchestrateur Principal
 */

import Auth from '../../services/auth.js';
import IndexedDBManager from '../../services/IndexedDBManager.js';
import SyncEngine from '../../services/SyncEngine.js';
import NetworkStatus from '../../services/offline/NetworkStatus.js';
import TabCacheManager from '../../services/TabCacheManager.js';
import PhotoOrchestrator from '../../services/PhotoOrchestrator.js';
import SyncOrchestrator from '../../services/SyncOrchestrator.js';
import DashboardIcons from '../../components/dashboard-icons.js';
import LocationManager from '../../services/LocationManager.js';

// Imports Modals
import EstablishmentModal from "../../modals/EstablishmentModal.js";
import EventModal from "../../modals/EventModal.js";
import PublicEstablishmentModal from "../../modals/PublicEstablishmentModal.js";
import PublicEventModal from "../../modals/PublicEventModal.js";
import ProfileModal from '../../modals/ProfileModal.js';

// Imports Onglets
import AdminEstablishmentTab from "./tabs/AdminEstablishmentTab.js";
import AdminEventTab from "./tabs/AdminEventTab.js";
import AdminModerationTab from "./tabs/AdminModerationTab.js";
import AdminUserTab from "./tabs/AdminAccountTab.js";
import AdminBackupTab from "./tabs/AdminBackupTab.js";

class AdminDashboard {
  constructor() {
    this.container = null;
    this.currentUser = null;
    this.role = null;
    this.userId = null;
    this.activeTab = "establishments";
    this.activeTabInstance = null;

    this.globalPhotoPool = new Map();
    
    window.AdminDashboardInstance = this;
    console.log("🎛️ AdminDashboard initialisé");
  }

  async init() {
    console.log("🚀 Initialisation AdminDashboard...");

    if (!Auth.isAuthenticated()) {
        window.BarzikApp.navigateTo("/auth");
        return;
    }

    this.currentUser = Auth.getCurrentUser();
    if (this.currentUser.role !== "admin") {
        window.BarzikApp.navigateTo("/public");
        return;
    }
    
    this.role = this.currentUser.role;
    this.userId = this.currentUser.id;

    this.container = document.getElementById("app");
    if (!this.container) throw new Error("Container #app introuvable");

    await IndexedDBManager.init();    
    
    this.render();

   window.RealtimeListener?.initializeRealtime();
   console.log("✅ Realtime listener initialisé");
    
    // ✅ NOUVEAU : Nettoyer photos orphelines au démarrage
    await this.cleanupOrphanedPhotos();
            
    
  await this.autoSync();
  // 🆕 Initialiser SyncOrchestrator
try {
  await window.SyncOrchestrator?.init();
  console.log('✅ SyncOrchestrator initialisé');
} catch (error) {
  console.warn('⚠️ SyncOrchestrator init error:', error);
}

// 🆕 Écouter les events de sync
window.addEventListener('orchestratorSyncCompleted', (e) => {
  console.log('✅ Sync orchestration completed:', e.detail);
  this.updateLastSyncTime();
  this.renderActiveTab();
});

window.addEventListener('orchestratorSyncFailed', (e) => {
  console.error('❌ Sync orchestration failed:', e.detail);
  this.showNotification(`Sync error: ${e.detail.error}`, 'error');
});

// 🆕 Initialiser PhotoOrchestrator cleanup auto
console.log('🖼️ PhotoOrchestrator ready');
}

  async autoSync() {
    try {
        console.log("🔄 Auto-sync...");     
        
        // ✅ FIX: Marquer anciens établissements comme created_locally
        const localEstabs = await IndexedDBManager.getAll('establishments');
        for (const est of localEstabs) {
            if (est.created_locally === undefined && est.supabase_synced !== true) {
                est.created_locally = true;  // Marquer comme créé localement
                await IndexedDBManager.put('establishments', est);
                console.log(`✅ Marqué created_locally=true: ${est.id.substring(0, 8)}`);
            }
        }

        if (!window.AdminDashboardInstance.globalPhotoPool) {
      window.AdminDashboardInstance.globalPhotoPool = new Map();
      console.log('[PHOTO] Global photo pool initialise');
        }

        await new Promise(resolve => requestAnimationFrame(resolve));      
        this.showSyncStatus(true);

        // Sync bidirectionnelle complète
        const result = await SyncEngine.syncAll(this.role, this.userId);
        
        if (result.success) {
            this.showNotification("Données synchronisées", "success");
            this.updateLastSyncTime();
        } else {
            this.showNotification("❌ Erreur de synchronisation", "error");
        }

    } catch (err) {
        console.warn("⚠️ Sync échouée:", err);
        this.showNotification("❌ Sync échouée", "error");
    } finally {
        await new Promise(resolve => requestAnimationFrame(resolve));
        this.showSyncStatus(false);
    }    
}

async handlePhotoRefCounting(item, itemType) {
  if (!item.photo_hash) return;

  try {
    const allRefs = await window.IndexedDBManager.getAll('photo_refs');
    const refsToDelete = allRefs.filter(ref => ref.photo_hash === item.photo_hash && ref.item_id === item.id);
    
    for (const ref of refsToDelete) {
      await window.IndexedDBManager.delete('photo_refs', ref.id);
      console.log('🗑️ Photo ref IndexedDB supprimée:', ref.id.substring(0, 8));
    }

    const remaining = allRefs.filter(ref => ref.photo_hash === item.photo_hash && ref.item_id !== item.id);
    
    if (remaining.length === 0) {
      await window.IndexedDBManager.delete('app_metadata', `photo_hash_${item.photo_hash}`);
      console.log('🗑️ app_metadata IndexedDB SUPPRIMÉE (count était 1)');
      
      if (item.photo_id) {
        await window.IndexedDBManager.delete('photos', item.photo_id);
        console.log('🗑️ Photo blob IndexedDB supprimée');
      }
    } else {
      const newCount = remaining.length;
      await window.IndexedDBManager.put('app_metadata', {
        key: `photo_hash_${item.photo_hash}`,
        hash: item.photo_hash,
        count: newCount,
        updated_at: new Date().toISOString()
      });
      console.log(`📊 app_metadata IndexedDB DÉCRÉMENTÉE: count = ${newCount}`);
    }
  } catch (error) {
    console.warn('⚠️ Error managing photo refs:', error);
  }
}

/**
 * 🔄 Déclencher sync après création/modification
 */
async triggerSync() {
  console.log('🔄 triggerSync() APPELÉE');
  console.log('🔄 Avant SyncEngine.syncAll...');
  
  try {
    const result = await window.SyncEngine.syncAll(
      this.role,  // ✅ BON
      this.userId
    );
    
    console.log('🔄 Après SyncEngine.syncAll');
    console.log('✅ triggerSync() TERMINÉE');
    
    return result;
  } catch (error) {
    console.error('❌ triggerSync error:', error);
    throw error;
  }
}

  setupEventListeners() {
  // Événement data changed
  window.addEventListener("dataChanged", () => {
    console.log("📡 Data changed, rafraîchissement onglet actif");
    this.renderActiveTab();
  });
 
     // Location button - GPS
const locationBtn = document.getElementById("location-btn");
if (locationBtn) {
    locationBtn.addEventListener("click", async () => {
        console.log("📍 Bouton GPS cliqué");
        await this.handleLocationGPS();
    });
} else {
    console.warn("⚠️ Bouton location-btn introuvable");
}

// City search - Autocomplete
const citySearchInput = document.getElementById("city-search");
if (citySearchInput) {
    let searchTimeout;
    
    citySearchInput.addEventListener("input", async (e) => {
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            document.getElementById("city-suggestions").innerHTML = '';
            return;
        }
        
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            try {
                console.log('🔍 Recherche ville:', query);
                const cities = await window.GeocodingService?.searchCities(query);
                
                if (cities && cities.length > 0) {
                    const datalist = document.getElementById("city-suggestions");
                    datalist.innerHTML = cities
                        .slice(0, 5)
                        .map(city => `<option value="${city.name}"></option>`)
                        .join('');
                    console.log('✅ Suggestions:', cities.map(c => c.name));
                }
            } catch (error) {
                console.error('❌ Erreur recherche ville:', error);
            }
        }, 300);
    });
    
    // Sélection ville
    citySearchInput.addEventListener("change", async (e) => {
        const selectedCity = e.target.value.trim();
        
        if (!selectedCity) return;
        
        try {
            console.log('🌍 Sélection ville:', selectedCity);
            const location = await window.LocationManager?.setTemporaryLocation(selectedCity);
            
            if (location) {
                this.showNotification(`📍 ${location.city}`, 'success');
                citySearchInput.value = '';
                await this.updateLocationDisplay();
                await this.triggerSync();
                
                if (this.activeTabInstance) {
                    this.activeTabInstance.refreshView();
                }
            }
        } catch (error) {
            console.error('❌ Erreur sélection ville:', error);
            this.showNotification(`Ville non trouvée: ${error.message}`, 'error');
            citySearchInput.value = '';
        }
    });
}

 
  document.querySelectorAll(".nav-tab-responsive").forEach(tab => {
    tab.addEventListener("click", e => {
      e.preventDefault();
      this.switchTab(tab.dataset.tab);
    });
  });
}

  async handleLocationChoice() {
  console.log('ðŸŒ handleLocationChoice:');

  if (!window.LocationManager) {
    this.showNotification('LocationManager non disponible', 'error');
    return;
  }

  const currentLocation = await window.LocationManager.getUserLocation()
    .catch(() => null);
  
  if (!currentLocation) {
    this.showNotification('Position non disponible', 'warning');
    return;
  }

  const useGPS = confirm(
    `Position actuelle: ${currentLocation.city}\n\nGPS (OK) ou Saisie manuelle (Annuler)?`
  );
  
  try {
    let location;
    
    if (useGPS) {
      console.log('GPS en cours...');
      location = await window.LocationManager.refreshLocation();
      this.showNotification(`Position GPS: ${location.city}`, 'success');
    } else {
      console.log('Saisie manuelle...');
      
      let city = null;
      while (!city) {
        city = prompt('Tapez une ville (ou Annuler):');
        
        if (city === null) {
          console.log('Saisie annulée');
          return;
        }
        
        if (city.trim() === '') {
          alert('Veuillez entrer une ville');
          city = null;
          continue;
        }
        
        city = city.trim();
      }
      
      location = await window.LocationManager.setTemporaryLocation(city);
      this.showNotification(`Position: ${location.city}`, 'success');
    }
    
    console.log('Position:', location);
    await this.triggerSync();
    await this.updateLocationDisplay();
    
    if (this.activeTabInstance) {
      this.activeTabInstance.refreshView();
    }
    
  } catch (error) {
    console.error('Erreur handleLocationChoice:', error);
    this.showNotification(`Erreur: ${error.message}`, 'error');
  }

}

  /**
 * GPS - Rafraîchir position depuis géolocalisation
 */
async handleLocationGPS() {
    try {
        console.log('GPS demandé...');
        const location = await window.LocationManager?.refreshLocation();
        
        if (location) {
            this.showNotification(`Position GPS: ${location.city}`, 'success');
            await this.updateLocationDisplay();
            await this.triggerSync();
            
            if (this.activeTabInstance) {
                this.activeTabInstance.refreshView();
            }
        } else {
            this.showNotification('Position GPS indisponible', 'warning');
        }
    } catch (error) {
        console.error('Erreur GPS:', error);
        this.showNotification(`GPS échoué: ${error.message}`, 'error');
    }
}

  async updateLocationDisplay() {
    const location = await window.LocationManager?.getUserLocation().catch(() => null);
    const displayEl = document.getElementById('location-display');
    
    if (displayEl && location) {
        displayEl.textContent = `${location.city || 'Ma position'}`;
        console.log('Affichage position:', location.city);
    }
}

  async render() {
  if (!this.container) return;
  this.container.innerHTML = this.getHTML();
  this.setupNavigationListeners();  
  this.renderActiveTab();   
  this.updateLastSyncTime();
  await this.updateLocationDisplay();
}

  getHTML() {
    return `
      <div class="admin-dashboard">
        
        <header class="admin-header-with-nav">
          <div class="header-container-centered">
            
            <div class="header-brand-centered">
            <div class="brand-logo">
            <img src="/public/logos/bk-logo.png" alt="Logo Barzik">
            </div>
            <div class="brand-text">
            <h1 class="brand-title">Barzik Agenda Live Music</h1>
            <span class="brand-subtitle">Tableau de bord Administration</span>
            </div>
          </div>
            
            <div class="header-meta-centered">
            <div class="meta-user">
              ${this.currentUser?.name || this.currentUser?.email}
            </div>
            <div class="meta-location">
  <div class="location-input-wrapper">
    <input type="text" id="city-search" class="city-search-input" 
           placeholder="Chercher une ville..." autocomplete="off">
    <datalist id="city-suggestions"></datalist>
    <button class="btn-location" id="location-btn" title="Géolocalisation GPS">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
    </button>
  </div>
  <span id="location-display" class="location-display-text">Ma position</span>
</div>
            <div class="sync-badge">
    ${!NetworkStatus.isOnline() ? '⚠️ OFFLINE' : '✅ ONLINE'}
</div>
          </div>

          <div class="nav-section-in-header">
            <div class="nav-container">
              <ul class="nav-tabs-responsive" role="tablist">
                <li>
  <button class="nav-tab-responsive ${this.activeTab==="establishments"?"active":""}" 
          data-tab="establishments">
    <span class="tab-icon">${DashboardIcons.establishments}</span>
    <span class="tab-text-desktop">Établissements</span>
  </button>
</li>
<li>
  <button class="nav-tab-responsive ${this.activeTab==="events"?"active":""}" 
          data-tab="events">
    <span class="tab-icon">${DashboardIcons.events}</span>
    <span class="tab-text-desktop">Événements</span>
  </button>
</li>
<li>
  <button class="nav-tab-responsive ${this.activeTab==="moderation"?"active":""}" 
          data-tab="moderation">
    <span class="tab-icon">${DashboardIcons.moderation}</span>
    <span class="tab-text-desktop">Modération</span>
  </button>
</li>
<li>
  <button class="nav-tab-responsive ${this.activeTab==="users"?"active":""}" 
          data-tab="users">
    <span class="tab-icon">${DashboardIcons.users}</span>
    <span class="tab-text-desktop">Comptes</span>
  </button>
</li>
<li>
  <button class="nav-tab-responsive ${this.activeTab==="backup"?"active":""}" 
          data-tab="backup">
    <span class="tab-icon">${DashboardIcons.backup}</span>
    <span class="tab-text-desktop">Sauvegarde</span>
  </button>
</li>
              </ul>
            </div>
          </div>
        </header>

        <main class="admin-main">
          <div id="tab-content" class="tab-content"></div>
        </main>        
      </div>
    `;
  }

  setupNavigationListeners() {
    console.log('🔧 setupNavigationListeners appelé');

    // Nav tabs
    document.querySelectorAll(".nav-tab-responsive").forEach(tab => {
        tab.addEventListener("click", e => {
            e.preventDefault();
            this.switchTab(tab.dataset.tab);
        });
    });

    // City search - avec protection double attachement
    const citySearchInput = document.getElementById("city-search");
    if (citySearchInput && !citySearchInput.dataset.listenerAttached) {
        citySearchInput.dataset.listenerAttached = 'true';
        let searchTimeout;

        citySearchInput.addEventListener("input", async (e) => {
            const query = e.target.value.trim();
            if (query.length < 2) {
                document.getElementById("city-suggestions").innerHTML = '';
                return;
            }
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                try {
                    console.log('🔍 Recherche ville:', query);
                    const cities = await window.GeocodingService?.searchCities(query);
                    if (cities && cities.length > 0) {
                        const datalist = document.getElementById("city-suggestions");
                        datalist.innerHTML = cities
                            .slice(0, 5)
                            .map(city => `<option value="${city.name}"></option>`)
                            .join('');
                        console.log('✅ Suggestions:', cities.map(c => c.name));
                    }
                } catch (error) {
                    console.error('❌ Erreur recherche ville:', error);
                }
            }, 300);
        });

        citySearchInput.addEventListener("change", async (e) => {
            const selectedCity = e.target.value.trim();
            if (!selectedCity) return;
            try {
                console.log('🌍 Sélection ville:', selectedCity);
                const location = await window.LocationManager?.setTemporaryLocation(selectedCity);
                if (location) {
                    this.showNotification(`📍 ${location.city}`, 'success');
                    citySearchInput.value = '';
                    await this.updateLocationDisplay();
                    await this.triggerSync();
                    if (this.activeTabInstance) {
                        this.activeTabInstance.refreshView();
                    }
                }
            } catch (error) {
                console.error('❌ Erreur sélection ville:', error);
                this.showNotification(`Ville non trouvée: ${error.message}`, 'error');
                citySearchInput.value = '';
            }
        });
    }

    // Bouton GPS
    const locationBtn = document.getElementById("location-btn");
    if (locationBtn && !locationBtn.dataset.listenerAttached) {
        locationBtn.dataset.listenerAttached = 'true';
        locationBtn.addEventListener("click", async () => {
            const cityInput = document.getElementById("city-search");
            const selectedCity = cityInput?.value?.trim();
            if (selectedCity) {
                try {
                    const location = await window.LocationManager?.setTemporaryLocation(selectedCity);
                    if (location) {
                        this.showNotification(`📍 ${location.city}`, 'success');
                        cityInput.value = '';
                        await this.updateLocationDisplay();
                        await this.triggerSync();
                        if (this.activeTabInstance) {
                            this.activeTabInstance.refreshView();
                        }
                    }
                } catch (error) {
                    this.showNotification(`Ville non trouvée: ${error.message}`, 'error');
                }
            } else {
                await this.handleLocationGPS();
            }
        });
    }
}
  
  switchTab(tabName) {
    this.activeTab = tabName;
    
    document.querySelectorAll(".nav-tab-responsive").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === tabName);
    });
    
    this.renderActiveTab();
  }

  renderActiveTab() {
    const container = document.getElementById("tab-content");
    if (!container) return;

    if (this.activeTabInstance?.cleanup) {
      try { this.activeTabInstance.cleanup(); } catch (_) {}
    }

    this.activeTabInstance = null;

    switch (this.activeTab) {
      case "establishments":
        this.activeTabInstance = new AdminEstablishmentTab(this);
        this.activeTabInstance.render(container);
        break;
        
      case "events":
        this.activeTabInstance = new AdminEventTab(this);
        this.activeTabInstance.render(container);
        break;
        
      case "moderation":
        this.activeTabInstance = new AdminModerationTab(this);
        this.activeTabInstance.render(container);
        break;
        
      case "users":
        this.activeTabInstance = new AdminUserTab(this);
        this.activeTabInstance.render(container);
        break;
        
      case "backup":
        this.activeTabInstance = new AdminBackupTab(this);
        this.activeTabInstance.render(container);
        break;
        
      default:
        container.innerHTML = `<p>Onglet ${this.activeTab} inconnu</p>`;
    }
  }

  async createEstablishment() {
    await window.EstablishmentModal.open(null, this.userId, this.role);
    
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    if (this.activeTabInstance?.refreshView) {
        if (!this.activeTabInstance._isRefreshing) {
            this.activeTabInstance._isRefreshing = true;
            await this.activeTabInstance.refreshView();
            this.activeTabInstance._isRefreshing = false;
        }
    }
    
    this.triggerSync();
}

async createEvent() {
    await window.EventModal.open(null, this.userId, this.role);
    
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    if (this.activeTabInstance?.refreshView) {
        if (!this.activeTabInstance._isRefreshing) {
            this.activeTabInstance._isRefreshing = true;
            await this.activeTabInstance.refreshView();
            this.activeTabInstance._isRefreshing = false;
        }
    }
    
    this.triggerSync();
}

  async editEstablishment(id) {
    await new Promise(resolve => setTimeout(resolve, 50));
    const estab = await IndexedDBManager.get("establishments", id);
    if (!estab) {
      this.showNotification("Établissement introuvable", "error");
      return;
    }
    await window.EstablishmentModal.open(estab, this.userId, this.role);
  }

  /**
   * 🔄 HANDLE ESTABLISHMENT EDIT SUBMIT - Détection changements + upload
   */
  async handleEstablishmentEditSubmit(originalItem, modifiedItem, userRole, userId) {
    console.log(`🔄 handleEstablishmentEditSubmit: ${originalItem.id.substring(0, 8)}`);

    try {
      // STEP 1: Détecter changements
      if (!window.DataChangeDetector) {
        console.warn('⚠️ DataChangeDetector non disponible');
        return { success: false, error: 'Service non disponible' };
      }

      const changes = window.DataChangeDetector.detectEstablishmentChanges(
        originalItem, 
        modifiedItem
      );

      if (!changes.hasChanges) {
        console.log('ℹ️ Aucune modification détectée');
        this.showNotification('Aucune modification', 'info');
        return { success: false, noChanges: true };
      }

      console.log(`🔄 Changements détectés:`, window.DataChangeDetector.formatChanges(changes));

      // STEP 2: Déterminer status après modif
      const nextStatus = window.DataChangeDetector.getNextStatus(
        userRole,
        originalItem.status,
        changes.photoChanged
      );

      console.log(`📊 Status: ${originalItem.status} → ${nextStatus}`);

      // STEP 3: Préparer données à uploader
      const itemToUpload = {
        ...modifiedItem,
        status: nextStatus,
        updated_at: new Date().toISOString(),
        version: (originalItem.version || 1) + 1
      };

      // STEP 4: Photo sync (optionnelle mais atomique)
      let photoUrl = itemToUpload.photo_url;
      let photoHash = itemToUpload.photo_hash;

      if (changes.photoChanged && modifiedItem.photo_id && !photoUrl) {
  console.log(`  🖼️ Photo modifiée, tentative upload...`);
  
  try {
    const photoRef = {
      photo_id: modifiedItem.photo_id,
      item_id: modifiedItem.id,
      item_type: 'establishment',
      status: 'local'
    };
    
    const uploadedUrl = await window.PhotoOrchestrator?.uploadPhoto(photoRef);
    
    if (uploadedUrl) {
      photoUrl = uploadedUrl;
      console.log(`  ✅ Photo uploadée`);
    }
  } catch (photoError) {
    console.warn(`  ⚠️ Photo upload failed: ${photoError.message}`);
  }
} else if (changes.photoChanged && !modifiedItem.photo_id) {
  photoUrl = null;
  photoHash = null;
  console.log(`  🗑️ Photo supprimée`);
}

      // STEP 5: Préparer supabaseData
      const supabaseData = {
        id: itemToUpload.id,
        nom: itemToUpload.nom,
        description: itemToUpload.description,
        adresse: itemToUpload.adresse,
        code_postal: itemToUpload.code_postal,
        ville: itemToUpload.ville,
        latitude: itemToUpload.latitude,
        longitude: itemToUpload.longitude,
        telephone: itemToUpload.telephone,
        email: itemToUpload.email,
        website: itemToUpload.website,
        facebook_url: itemToUpload.facebook_url,
        instagram_url: itemToUpload.instagram_url,
        type: itemToUpload.type,
        status: nextStatus,
        photo_url: photoUrl || null,
        photo_hash: photoHash || null,
        version: itemToUpload.version,
        updated_at: itemToUpload.updated_at,
        owner_id: itemToUpload.owner_id
      };

      // STEP 6: Upload vers Supabase
      console.log(`  🚀 Upserting to Supabase...`);
      const { data, error } = await window.supabaseInstance
        .from('establishments')
        .upsert(supabaseData, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;

      // STEP 7: Update IndexedDB
      await window.IndexedDBManager.put('establishments', {
        ...data,
        photo_id: modifiedItem.photo_id,
        supabase_synced: true,
        source: 'supabase'
      });

      // STEP 8: Notifier UI
      if (userRole === 'organizer' && nextStatus === 'pending') {
        this.showNotification('✏️ Modifications en attente de modération', 'info');
      } else {
        this.showNotification(`✅ Établissement modifié`, 'success');
      }

      // STEP 9: Invalider cache
      window.TabCacheManager?.invalidate('establishments');

      // STEP 10: Si status changé → Realtime notifie admin (via Supabase trigger)
      if (nextStatus !== originalItem.status) {
        console.log(`🔔 Status change will trigger Realtime notification to admin`);
      }

      return {
        success: true,
        message: 'Modification sauvegardée',
        newStatus: nextStatus,
        photoChanged: changes.photoChanged
      };

    } catch (error) {
      console.error('❌ Edit establishment error:', error);
      this.showNotification(`❌ Erreur: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteEstablishment(id) {
  const estab = await IndexedDBManager.get("establishments", id);
  if (!estab) return;
  
  if (confirm(`Supprimer "${estab.nom}" ?\n\nâš ï¸ Suppression dÃ©finitive...`)) {
    try {
      await IndexedDBManager.delete("establishments", id);
      
      if (estab.supabase_synced && window.supabaseInstance) {
        await window.supabaseInstance.from("establishment").delete().eq("id", id);
        
        if (estab.photo_hash) {
          await window.supabaseInstance.from("photo_refs").delete().eq("photo_hash", estab.photo_hash).eq("item_id", id);
          console.log('🗑️ photo_refs supprimée de Supabase');
          
          const remaining = await window.supabaseInstance.from("photo_refs").select("id").eq("photo_hash", estab.photo_hash);
          
          if (!remaining.data || remaining.data.length === 0) {
            await window.supabaseInstance.from("app_metadata").delete().eq("key", `photo_hash_${estab.photo_hash}`);
            console.log('🗑️ app_metadata SUPPRIMÉE (count était 1)');
            
            if (estab.photo_url && window.PhotoService) {
              await window.PhotoService.deletePhotos("establishment-photos", [estab.photo_url]);
              console.log('🗑️ Photo Storage SUPPRIMÉE');
            }
          } else {
            const newCount = remaining.data.length;
            await window.supabaseInstance.from("app_metadata").update({ count: newCount }).eq("key", `photo_hash_${estab.photo_hash}`);
            console.log(`📊 app_metadata DÉCREMENTÉE: count = ${newCount}`);
          }
        }
      }
      
      await this.handlePhotoRefCounting(estab, 'establishments');
      
      this.showNotification(`"${estab.nom}" supprimé`, "success");
      TabCacheManager.invalidate('establishments');
      
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      if (this.activeTabInstance?.refreshView) {
        if (!this.activeTabInstance._isRefreshing) {
          this.activeTabInstance._isRefreshing = true;
          await this.activeTabInstance.refreshView();
          this.activeTabInstance._isRefreshing = false;
        }
      } else {
        this.renderActiveTab();
      }
      
    } catch (error) {
      console.error("❌ Erreur suppression:", error);
      this.showNotification("Erreur lors de la suppression", "error");
    }
  }
}

  async openPublicEstablishment(id) {
    const estab = await IndexedDBManager.get("establishments", id);
    if (!estab) return;
    
    await window.PublicEstablishmentModal.open(
      estab,
      (eventData, estabData) => {
        window.PublicEventModal.open(eventData, estabData);
      }
    );
  }

  /**
   * 🎪 HANDLE EVENT EDIT SUBMIT - Détection changements + upload
   */
  async handleEventEditSubmit(originalItem, modifiedItem, userRole, userId) {
    console.log(`🔄 handleEventEditSubmit: ${originalItem.id.substring(0, 8)}`);

    try {
      // STEP 1: Détecter changements
      if (!window.DataChangeDetector) {
        console.warn('⚠️ DataChangeDetector non disponible');
        return { success: false, error: 'Service non disponible' };
      }

      const changes = window.DataChangeDetector.detectEventChanges(
        originalItem, 
        modifiedItem
      );

      if (!changes.hasChanges) {
        console.log('ℹ️ Aucune modification détectée');
        this.showNotification('Aucune modification', 'info');
        return { success: false, noChanges: true };
      }

      console.log(`🔄 Changements détectés:`, window.DataChangeDetector.formatChanges(changes));

      // STEP 2: Déterminer status après modif
      const nextStatus = window.DataChangeDetector.getNextStatus(
        userRole,
        originalItem.status,
        changes.photoChanged
      );

      console.log(`📊 Status: ${originalItem.status} → ${nextStatus}`);

      // STEP 3: Préparer données à uploader
      const itemToUpload = {
        ...modifiedItem,
        status: nextStatus,
        updated_at: new Date().toISOString(),
        version: (originalItem.version || 1) + 1,
        establishment_id: modifiedItem.establishment_id || originalItem.establishment_id  // ✅ IMPORTANT
      };

      // STEP 4: Photo sync (optionnelle mais atomique)
      let photoUrl = itemToUpload.photo_url;
      let photoHash = itemToUpload.photo_hash;

      if (changes.photoChanged && modifiedItem.photo_id && !photoUrl) {
  console.log(`  🖼️ Photo modifiée, tentative upload...`);
  
  try {
    const photoRef = {
      photo_id: modifiedItem.photo_id,
      item_id: modifiedItem.id,
      item_type: 'event',
      status: 'local'
    };
    
    const uploadedUrl = await window.PhotoOrchestrator?.uploadPhoto(photoRef);
    
    if (uploadedUrl) {
      photoUrl = uploadedUrl;
      console.log(`  ✅ Photo uploadée`);
    }
  } catch (photoError) {
    console.warn(`  ⚠️ Photo upload failed: ${photoError.message}`);
  }
} else if (changes.photoChanged && !modifiedItem.photo_id) {
  photoUrl = null;
  photoHash = null;
  console.log(`  🗑️ Photo supprimée`);
}

      // STEP 5: Vérifier date_debut pas passée
      const eventDate = new Date(modifiedItem.date_debut);
      const cutoffDate = this.getCutoffDateForEvents();
      
      if (eventDate < cutoffDate) {
        this.showNotification('⚠️ La date de l\'événement ne peut pas être passée', 'warning');
        return { success: false, error: 'Date passée' };
      }

      // STEP 6: Préparer supabaseData (spécifique events)
      const supabaseData = {
        id: itemToUpload.id,
        titre: itemToUpload.titre,
        category: itemToUpload.category,
        description: itemToUpload.description,
        adresse: itemToUpload.adresse,
        code_postal: itemToUpload.code_postal,
        ville: itemToUpload.ville,
        latitude: itemToUpload.latitude,
        longitude: itemToUpload.longitude,
        date_debut: itemToUpload.date_debut,
        date_fin: itemToUpload.date_fin || null,
        establishment_id: itemToUpload.establishment_id,
        facebook_url: itemToUpload.facebook_url,
        bandcamp_url: itemToUpload.bandcamp_url,
        helloasso_url: itemToUpload.helloasso_url,
        youtube_url1: itemToUpload.youtube_url1,
        youtube_url2: itemToUpload.youtube_url2,
        youtube_url3: itemToUpload.youtube_url3,
        status: nextStatus,
        photo_url: photoUrl || null,
        photo_hash: photoHash || null,
        version: itemToUpload.version,
        updated_at: itemToUpload.updated_at,
        owner_id: itemToUpload.owner_id
      };

      // STEP 7: Upload vers Supabase
      console.log(`  🚀 Upserting to Supabase...`);
      const { data, error } = await window.supabaseInstance
        .from('events')
        .upsert(supabaseData, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;

      // STEP 8: Update IndexedDB
      await window.IndexedDBManager.put('events', {
        ...data,
        photo_id: modifiedItem.photo_id,
        supabase_synced: true,
        source: 'supabase'
      });

      // STEP 9: Notifier UI
      if (userRole === 'organizer' && nextStatus === 'pending') {
        this.showNotification('✏️ Modifications en attente de modération', 'info');
      } else {
        this.showNotification(`✅ Événement modifié`, 'success');
      }

      // STEP 10: Invalider cache
      window.TabCacheManager?.invalidate('events');

      // STEP 11: Si status changé → Realtime notifie admin
      if (nextStatus !== originalItem.status) {
        console.log(`🔔 Status change will trigger Realtime notification to admin`);
      }

      return {
        success: true,
        message: 'Modification sauvegardée',
        newStatus: nextStatus,
        photoChanged: changes.photoChanged
      };

    } catch (error) {
      console.error('❌ Edit event error:', error);
      this.showNotification(`❌ Erreur: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 📅 GET CUTOFF DATE FOR EVENTS - Pour vérifier date future
   */
  getCutoffDateForEvents() {
    const now = new Date();
    const cutoff = new Date(now);
    
    cutoff.setHours(0, 0, 0, 0);
    
    if (now.getHours() < 3) {
      cutoff.setDate(cutoff.getDate() - 1);
    }
    
    return cutoff;
  }

    async editEvent(id) {
    await new Promise(resolve => setTimeout(resolve, 50));  
    const evt = await IndexedDBManager.get("events", id);
    if (!evt) {
      this.showNotification("Événement introuvable", "error");
      return;
    }
    await window.EventModal.open(evt, this.userId, this.role);
    
  }

  async deleteEvent(id) {
  const evt = await IndexedDBManager.get("events", id);
  if (!evt) return;
  
  if (confirm(`Supprimer "${evt.titre}" ?\n\nâš ï¸ Suppression dÃ©finitive (Ã©vÃ©nement + photo).`)) {
    try {
      await IndexedDBManager.delete("events", id);
      
      if (evt.supabase_synced && window.supabaseInstance) {
        await window.supabaseInstance.from("events").delete().eq("id", id);
        
        if (evt.photo_hash) {
          await window.supabaseInstance.from("photo_refs").delete().eq("photo_hash", evt.photo_hash).eq("item_id", id);
          console.log('🗑️ photo_refs supprimée de Supabase');
          
          const remaining = await window.supabaseInstance.from("photo_refs").select("id").eq("photo_hash", evt.photo_hash);
          
          if (!remaining.data || remaining.data.length === 0) {
            await window.supabaseInstance.from("app_metadata").delete().eq("key", `photo_hash_${evt.photo_hash}`);
            console.log('🗑️ app_metadata SUPPRIMÉE (count était 1)');
            
            if (evt.photo_url && window.PhotoService) {
              await window.PhotoService.deletePhotos("event-photos", [evt.photo_url]);
              console.log('🗑️ Photo Storage SUPPRIMÉE');
            }
          } else {
            const newCount = remaining.data.length;
            await window.supabaseInstance.from("app_metadata").update({ count: newCount }).eq("key", `photo_hash_${evt.photo_hash}`);
            console.log(`📊 app_metadata DÉCREMENTÉE: count = ${newCount}`);
          }
        }
      }
      
      await this.handlePhotoRefCounting(evt, 'events');
      
      this.showNotification(`"${evt.titre}" supprimé`, "success");
      TabCacheManager.invalidate('events');
      
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      if (this.activeTabInstance?.refreshView) {
        if (!this.activeTabInstance._isRefreshing) {
          this.activeTabInstance._isRefreshing = true;
          await this.activeTabInstance.refreshView();
          this.activeTabInstance._isRefreshing = false;
        }
      } else {
        this.renderActiveTab();
      }
      
    } catch (error) {
      console.error("❌ Erreur suppression:", error);
      this.showNotification("Erreur lors de la suppression", "error");
    }
  }
}

  async openPublicEvent(id) {
    const evt = await IndexedDBManager.get("events", id);
    if (!evt) return;
    
    const estab = await IndexedDBManager.get("establishments", evt.establishment_id);
    
    await window.PublicEventModal.open(
      evt,
      estab,
      (estabData) => {
        window.PublicEstablishmentModal.open(estabData);
      }
    );
  }

  showSyncStatus(syncing) {
    const indicator = document.querySelector("#sync-status .status-indicator");
    if (!indicator) return;
    
    indicator.textContent = syncing ? "🔄 Sync..." : "Sync OK";
    indicator.className = `status-indicator ${syncing ? 'syncing' : 'success'}`;
  }

  async updateLastSyncTime() {
    const lastSync = await IndexedDBManager.getMeta('lastSync');
    const timeEl = document.getElementById('last-sync-time');
    if (timeEl && lastSync) {
      const date = new Date(lastSync);
      timeEl.textContent = `Sync: ${date.toLocaleTimeString('fr-FR')}`;
    }
  }

  showNotification(msg, type = "info") {
    if (window.BarzikToast) {
      window.BarzikToast.show(msg, type);
    } else {
      this.showInlineNotification(msg, type);
    }
  }

  showInlineNotification(msg, type) {
    const notification = document.createElement('div');
    notification.className = `inline-notification ${type}`;
    notification.innerHTML = `
      <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span class="notification-text">${msg}</span>
    `;
    
    document.body.appendChild(notification);
    
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  
  /**
 * 🧹 CLEANUP ORPHANED PHOTOS - Nettoyer les photos sans items
 */
async cleanupOrphanedPhotos() {
  try {
    console.log('🧹 Cleanup orphaned photos...');
    
    // Utiliser PhotoOrchestrator pour le cleanup complet
    // (supprime local + Supabase Storage)
    const result = await window.PhotoOrchestrator?.cleanup();
    
    if (result) {
      console.log(`✅ Cleanup complete - Local: ${result.deletedLocal}, Supabase: ${result.deletedSupabase}`);
      if (result.deletedLocal > 0 || result.deletedSupabase > 0) {
        this.showNotification(`Nettoyage: ${result.deletedLocal + result.deletedSupabase} photos supprimées`, 'success');
      }
    }
  } catch (error) {
    console.warn('⚠️ Cleanup error:', error);
  }
}

  async forceRefresh() {
    this.showSyncStatus(true);
    try {
      await SyncEngine.syncAll(this.role, this.userId);
      
      this.showNotification("Données actualisées", "success");
      this.updateLastSyncTime();
    } catch (error) {
      this.showNotification("Erreur lors de l'actualisation", "error");
    } finally {  
      await new Promise(resolve => requestAnimationFrame(resolve));  
      this.showSyncStatus(false);
    }
  }
 

}

window.AdminDashboard = AdminDashboard;
export default AdminDashboard;