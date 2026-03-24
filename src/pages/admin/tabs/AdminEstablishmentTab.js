/**
 * 🏢 ADMIN ESTABLISHMENT TAB
 */

import IndexedDBManager from "../../../services/IndexedDBManager.js";
import TabCacheManager from '../../../services/TabCacheManager.js';
import DashboardIcons from '../../../components/dashboard-icons.js';


class AdminEstablishmentTab {
  constructor(dashboard) {
    this.dashboard = dashboard;
    
    // Filtres
    this.distanceFilter = 20;
    this.sortBy = 'distance';
    this.searchQuery = '';
    this.filter = 'all';
    
    this.establishments = [];
    
    // Pool d'objectURLs (NOUVEAU)
    this.photoObjectUrls = dashboard.globalPhotoPool;
  }

  async render(container) {
  // Charger Établissements pour le menu (fait une fois)
  if (this.establishments.length === 0) {
    this.establishments = await IndexedDBManager.getAll("establishments");
    console.log(`🏢 Établissements chargés: ${this.establishments.length}`);
  }
  
  // Utiliser cache
  const cached = await TabCacheManager.getOrFetch(
      'establishments',
      () => this.getFilteredEstablishments()
  );

  this.establishments = cached?.items || [];
  this.filter = cached?.filter || 'all';
  this.sortBy = cached?.sort || 'distance';
  this.searchQuery = cached?.searchQuery || '';
  this.distanceFilter = cached?.distanceFilter || 20;

  container.innerHTML = await this.getHTML(this.establishments);
  this.setupEventListeners(container);
}

  async getFilteredEstablishments() {
    let establishments = await IndexedDBManager.getAll("establishments");
    
    // 1. Filtrer par statut
    if (this.filter !== 'all') {
        establishments = establishments.filter(e => e.status === this.filter);
    }
    
    // 2. Filtrer par recherche
    if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        establishments = establishments.filter(e => 
            e.nom?.toLowerCase().includes(query) ||
            e.type?.toLowerCase().includes(query) ||
            e.adresse?.toLowerCase().includes(query)
        );
    }
    
    // 3. Filtrer par distance
    try {
        const userLocation = await window.LocationManager?.getUserLocation().catch(() => null);
        
        if (userLocation && window.DistanceCalculator) {
            // Calculer distance pour TOUS
            establishments = establishments.map(estab => {
                const distance = window.DistanceCalculator.haversine(
                    userLocation.latitude, userLocation.longitude,
                    estab.latitude, estab.longitude
                );
                return {
                    ...estab,
                    distance_km: parseFloat(distance.toFixed(2)),
                    distance_formatted: window.DistanceCalculator.format(distance)
                };
            });
            
            // Filtrer par rayon distance
            establishments = establishments.filter(e => e.distance_km <= this.distanceFilter);
            
            console.log(`📍 ${establishments.length} établissements dans ${this.distanceFilter}km`);
        }
    } catch (error) {
        console.warn('⚠️ Erreur calcul distance:', error);
    }
    
    // 4. Trier
    establishments.sort((a, b) => {
        switch (this.sortBy) {
            case 'distance':
                return (a.distance_km || 0) - (b.distance_km || 0);
            case 'name':
                return (a.nom || '').localeCompare(b.nom || '');
            case 'date':
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            case 'status':
                return (a.status || '').localeCompare(b.status || '');
            default:
                return 0;
        }
    });
    
    return establishments;
}

  async getCardsHTML(establishments) {
    const cards = establishments.map(async (estab) => {
        const originInfo = this.getItemOriginInfo(estab);
        const photoUrl = await this.getPhotoUrl(estab);
        const createdDate = estab.created_at ? 
            new Date(estab.created_at).toLocaleDateString('fr-FR') : 'N/A';
        
        // Distance badge
        let distanceHTML = '';
        if (estab.distance_km !== undefined) {
            const distanceFormatted = estab.distance_km < 1 
                ? `${Math.round(estab.distance_km * 1000)} m`
                : `${estab.distance_km.toFixed(1)} km`;
            
            distanceHTML = `
                <div class="card-distance-badge bottom-left">
                    📍 ${distanceFormatted}
                </div>
            `;
        }
        
        return `
            <article class="establishment-card" data-id="${estab.id}">
                
                <div class="card-photo-section" onclick="AdminDashboardInstance.openPublicEstablishment('${estab.id}')">
                    ${photoUrl
                        ? `<img src="${photoUrl}" alt="${estab.nom}" class="card-photo" loading="lazy">`
                        : `<div class="card-photo-placeholder">
                             <span class="placeholder-icon">🏢</span>
                           </div>`}
                    
                    <div class="card-status-dot ${originInfo.class}" title="${originInfo.tooltip}"></div>
                    ${distanceHTML}
                </div>

                <div class="card-info-section-centered">
                    <h3 class="card-title">${estab.nom || 'Sans nom'}</h3>
                    <p class="card-type">${estab.type || '–'}</p>
                    <p class="card-address">${estab.adresse || estab.adresse_complete || 'Adresse non renseignée'}</p>
                    
                    <div class="card-meta">
                        ${estab.telephone ? `<span class="meta-item">📱 ${this.formatPhone(estab.telephone)}</span>` : ''}
                        ${estab.email ? `<span class="meta-item">📧 Email</span>` : ''}
                        ${estab.website ? `<span class="meta-item">🌐 Site web</span>` : ''}
                    </div>
                    
                    <div class="card-details">
                        <div class="detail-item">
                            <span class="detail-label">Créée:</span>
                            <span class="detail-value">${createdDate}</span>
                        </div>
                    </div>
                </div>

                <!-- FAB Delete -->
                <button class="card-fab-delete" data-action="delete" data-id="${estab.id}" title="Supprimer">
                    ${DashboardIcons.delete}
                </button>

                <!-- FAB Edit -->
                <button class="card-fab-edit" data-action="edit" data-id="${estab.id}" title="Modifier">
                    ${DashboardIcons.edit}
                </button>
                
            </article>
        `;
    });

    const htmlArray = await Promise.all(cards);
    return htmlArray.join('');
}

  async getPhotoUrl(item) {
    // ✅ PRIORITÉ 1 : Blob local via pool global
    if (item.photo_id) {
        // Vérifier si déjà dans le pool global
        if (this.photoObjectUrls.has(item.photo_id)) {
            const pooledUrl = this.photoObjectUrls.get(item.photo_id);
            if (pooledUrl && pooledUrl.startsWith('blob:')) {
                return pooledUrl;
            }
        }
        
        // Créer objectURL et la stocker UNIQUEMENT dans le pool global
        try {
            const photoData = await window.IndexedDBManager.get('photos', item.photo_id);
            if (photoData?.blob && photoData.blob instanceof Blob) {
                const objectUrl = URL.createObjectURL(photoData.blob);
                this.photoObjectUrls.set(item.photo_id, objectUrl);  // ✅ POOL GLOBAL
                console.log(`✅ ObjectURL créée et pooled: ${item.photo_id.substring(0, 8)}`);
                return objectUrl;
            }
        } catch (error) {
            console.warn('⚠️ Blob indisponible:', item.photo_id.substring(0, 8));
        }
    }
    
    // ✅ PRIORITÉ 2 : URL Supabase (fallback)
    if (item.photo_url) {
    console.log(`✅ Utilisant photo Supabase: ${item.photo_url.substring(0, 50)}...`);
    return item.photo_url;
}
    
    // ✅ PRIORITÉ 3 : Aucune photo
    return null;
}

  getStats(establishments) {
    return {
      total: establishments.length,
      pending: establishments.filter(e => e.status === 'pending').length,
      approved: establishments.filter(e => e.status === 'approved').length,
      rejected: establishments.filter(e => e.status === 'rejected').length,
      local: establishments.filter(e => e.status === 'local' || !e.supabase_synced).length
    };
}

  createStatItem(filter, value, label) {
  const isActive = this.filter === filter;
  return `
    <div class="stat-item ${isActive ? 'active' : ''}" data-filter="${filter}">
      <span class="stat-number">${value}</span>
      <span class="stat-label">${label}</span>
    </div>
  `;
}

  getItemOriginInfo(item) {
    switch (item.status) {
        case "local":
            return { class: "status-local", tooltip: "Local, non envoyé" };
        case "pending":
            return { class: "status-pending", tooltip: "En attente de validation" };
        case "approved":
            return { class: "status-approved", tooltip: "Validé et publié" };
        default:
            return { class: "status-unknown", tooltip: "Statut inconnu" };
    }
}

  
  getEmptyStateHTML() {
    const messages = {
    'all': { 
        icon: DashboardIcons.emptyBox,
            title: 'Aucun établissement', 
            message: 'Commencez par créer votre premier lieu',
            cta: 'Créer le premier établissement'
        },
        'pending': { 
            icon: '⏳', 
            title: 'Aucun établissement en attente', 
            message: 'Les nouveaux établissements apparaîtront ici',
            cta: 'Voir tous les établissements'
        },
        'approved': { 
            icon: '✅', 
            title: 'Aucun établissement publié', 
            message: 'Validez des établissements pour les publier',
            cta: 'Voir en attente'
        },

        'rejected': { 
            icon: '⛔', 
            title: 'Aucun établissement rejeté', 
            message: 'Les établissements rejetés apparaîtront ici',
            cta: 'Voir tous les établissements'
        },

        'local': { 
            icon: '💾', 
            title: 'Aucun établissement local', 
            message: 'Les établissements non synchronisés apparaîtront ici',
            cta: 'Voir tous les établissements'
        }
    };
    
    const config = messages[this.filter] || messages['all'];
    
    return `
        <div class="empty-state">
            <div class="empty-icon">${config.icon}</div>
            <h3>${config.title}</h3>
            <p>${config.message}</p>
            ${this.filter === 'all' ? `
                <button class="btn-add-first" id="create-establishment-empty">
                    ✨ ${config.cta}
                </button>
            ` : `
                <button class="btn-secondary" data-filter="${this.filter === 'pending' ? 'all' : 'pending'}">
                    ${config.cta}
                </button>
            `}
        </div>
    `;
  }

  async getHTML(establishments) {
    const stats = this.getStats(establishments);
    const cardsHTML = establishments.length > 0 
      ? await this.getCardsHTML(establishments) 
      : this.getEmptyStateHTML();
    
    return `
      <section class="tab-panel active">
        
        <div class="panel-header-centered">
          <h2>Gestion de Etablissements</h2>          
          
          <div class="quick-stats">
            ${this.createStatItem('all', stats.total, 'Total')}
            ${this.createStatItem('pending', stats.pending, 'En attente')}
            ${this.createStatItem('approved', stats.approved, 'Validés')}
            ${this.createStatItem('rejected', stats.rejected, 'Rejetés')}
            ${this.createStatItem('local', stats.local, 'Locaux')}
          </div>
        </div>
        
        <div class="toolbar-section">
  <div class="toolbar-left">
    <div class="search-container">
      <input type="text" class="search-input" id="search-establishments"
             placeholder="Rechercher un établissement..."
             value="${this.searchQuery}">
      <span class="search-icon">${DashboardIcons.search}</span>
    </div>
  </div>
  
  <div class="toolbar-right">
    <!-- Distance filter -->
    <select class="distance-select" id="distance-filter-establishments">
      <option value="20" ${this.distanceFilter===20?'selected':''}>Dans 20 km</option>
      <option value="50" ${this.distanceFilter===50?'selected':''}>Dans 50 km</option>
      <option value="100" ${this.distanceFilter===100?'selected':''}>Dans 100 km</option>
    </select>
    
    <!-- Sort by -->
    <select class="sort-select" id="sort-establishments">
      <option value="distance" ${this.sortBy==='distance'?'selected':''}>Trier par distance</option>
      <option value="name" ${this.sortBy==='name'?'selected':''}>Trier par nom</option>
      <option value="date" ${this.sortBy==='date'?'selected':''}>Trier par date</option>
      <option value="status" ${this.sortBy==='status'?'selected':''}>Trier par statut</option>
    </select>
    
    <div class="toolbar-actions">
      <button class="btn-toolbar" id="refresh-establishments" title="Actualiser">
        ${DashboardIcons.refresh}
      </button>
      <button class="btn-toolbar btn-primary" id="create-establishment" title="Nouvel établissement">
        ${DashboardIcons.add} Nouveau
      </button>
    </div>
  </div>
</div>
        
        <div class="establishments-grid">
          ${establishments.length > 0 ? await this.getCardsHTML(establishments) : this.getEmptyStateHTML()}
        </div>
      </section>
    `;
  }

  setupEventListeners(container) {

    window.addEventListener('itemUpdated', async (e) => {
    console.log('📝 itemUpdated event reçu:', e.detail.itemId);
    
    if (e.detail.itemType !== 'establishments') return;
    
    try {
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const updated = await IndexedDBManager.get('establishments', e.detail.itemId);
        
        if (updated) {
            console.log('✅ Établissement rechargé depuis IndexedDB');
            
            const card = document.querySelector(`[data-id="${e.detail.itemId}"]`);
            if (card) {
                // Mettre à jour juste le titre et l'adresse (comme AccountTab)
                const titleEl = card.querySelector('.card-title');
                const addressEl = card.querySelector('.card-address');
                
                if (titleEl) titleEl.textContent = updated.nom || 'Sans nom';
                if (addressEl) addressEl.textContent = updated.adresse || updated.adresse_complete || 'Adresse non renseignée';
                
                console.log('✅ Card mise à jour immédiatement');
            }
        }
    } catch (error) {
        console.error('❌ Erreur itemUpdated:', error);
    }
});

    // Stat filters
    container.querySelectorAll('.stat-item').forEach(item => {
        item.addEventListener('click', () => {
            this.filter = item.dataset.filter;
            TabCacheManager.updateFilter('establishments', this.filter, this.sortBy);
            this.refreshView();
        });
    });

    // Search
    const searchInput = container.querySelector('#search-establishments');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            TabCacheManager.updateSearch('establishments', this.searchQuery);
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.refreshView(), 300);
        });
    }

    // Distance filter
    const distanceSelect = container.querySelector('#distance-filter-establishments');
    if (distanceSelect) {
        distanceSelect.addEventListener('change', (e) => {
            this.distanceFilter = parseInt(e.target.value);
            console.log(`📍 Distance filter changé: ${this.distanceFilter}km`);
            this.refreshView();
        });
    }

    // Sort
    const sortSelect = container.querySelector('#sort-establishments');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            TabCacheManager.updateFilter('establishments', this.filter, this.sortBy);
            this.refreshView();
        });
    }

    // Refresh button
    const refreshBtn = container.querySelector('#refresh-establishments');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            this.dashboard.forceRefresh();
        });
    }

    // Create buttons
    const createBtn = container.querySelector('#create-establishment');
    const createEmptyBtn = container.querySelector('#create-establishment-empty');
    [createBtn, createEmptyBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                this.dashboard.createEstablishment();
            });
        }
    });

    // Card delegation
    const grid = container.querySelector('.establishments-grid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (!actionBtn) return;
            
            if (e.target.closest('.card-fab-delete') || e.target.closest('.card-fab-edit')) {
                e.stopPropagation();
                e.preventDefault();
            }
            
            const action = actionBtn.dataset.action;
            const id = actionBtn.dataset.id;
            
            switch (action) {
                case 'edit':
                    if (window.AdminDashboardInstance) {
        window.AdminDashboardInstance.activeTabInstance = this;
                     }
           this.dashboard.editEstablishment(id);
                    break;
                case 'delete':
                    this.dashboard.deleteEstablishment(id);
                    break;
            }
        });
    }
}

  async refreshView() {
  const container = document.getElementById('tab-content');
  if (container) {
    await this.render(container);
  }
}
  formatPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }
    return phone;
  }

  cleanup() {
    // NE PAS révoquer les blob URLs
    // Les garder vivants tant que l'app est active
    // Ils seront réutilisés lors du retour à l'onglet
    
    if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
    }
    
    console.log('Cleanup Tab - pool conservé');
}
}

export default AdminEstablishmentTab;