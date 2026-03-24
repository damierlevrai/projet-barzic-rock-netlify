/**
 * 🎭 ADMIN EVENT TAB - Corrigé
 * Fix: render() doit être async + getHTML() doit être async
 */

import IndexedDBManager from "../../../services/IndexedDBManager.js";
import TabCacheManager from '../../../services/TabCacheManager.js';
import DashboardIcons from '../../../components/dashboard-icons.js';


class AdminEventTab {
  constructor(dashboard) {
    this.dashboard = dashboard;
    
    // Filtres
    this.distanceFilter = 20;
    this.sortBy = 'distance';
    this.searchQuery = '';
    this.searchMode = 'all';
    this.establishmentFilter = null;
    this.filter = 'all';
    
    this.events = [];
    this.establishments = [];
    
    // Pool d'objectURLs (NOUVEAU)
    this.photoObjectUrls = dashboard.globalPhotoPool;
  }

  async render(container) {
    // Charger établissements pour le menu (fait une fois)
    if (this.establishments.length === 0) {
        this.establishments = await IndexedDBManager.getAll("establishments");
        console.log(`Établissements chargés: ${this.establishments.length}`);
    }
    
    // Utiliser cache
    const cached = await TabCacheManager.getOrFetch(
        'events',
        () => this.getFilteredEvents()
    );

    this.events = cached?.items || [];
    this.filter = cached?.filter || 'all';
    this.sortBy = cached?.sort || 'distance';
    this.searchQuery = cached?.searchQuery || '';
    this.distanceFilter = cached?.distanceFilter || 20;

    container.innerHTML = await this.getHTML(this.events);
    this.setupEventListeners(container);
}

  async getFilteredEvents() {
    let events = await IndexedDBManager.getAll("events");
    
    // 1. Filtrer par statut
    if (this.filter !== 'all') {
        events = events.filter(e => e.status === this.filter);
    }
    
    // 2. Filtrer par établissement (si sélectionné)
    if (this.establishmentFilter) {
        events = events.filter(e => e.establishment_id === this.establishmentFilter);
        console.log(`Filtré par établissement: ${events.length} événements`);
    }
    
    // 3. Filtrer par recherche
    if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        events = events.filter(e => 
            e.titre?.toLowerCase().includes(query) ||
            e.category?.toLowerCase().includes(query) ||
            e.description?.toLowerCase().includes(query)
        );
    }
    
    // 4. Filtrer par distance (SAUF si établissement sélectionné)
    if (!this.establishmentFilter) {
        try {
            const userLocation = await window.LocationManager?.getUserLocation().catch(() => null);
            
            if (userLocation && window.DistanceCalculator) {
                // Calculer distance pour TOUS
                events = events.map(evt => {
                    const distance = window.DistanceCalculator.haversine(
                        userLocation.latitude, userLocation.longitude,
                        evt.latitude, evt.longitude
                    );
                    return {
                        ...evt,
                        distance_km: parseFloat(distance.toFixed(2)),
                        distance_formatted: window.DistanceCalculator.format(distance)
                    };
                });
                
                // Filtrer par rayon distance
                events = events.filter(e => e.distance_km <= this.distanceFilter);
                
                console.log(`📍 ${events.length} événements dans ${this.distanceFilter}km`);
            }
        } catch (error) {
            console.warn('⚠️ Erreur calcul distance:', error);
        }
    } else {
        // Établissement sélectionné: calculer distance quand même pour affichage
        try {
            const userLocation = await window.LocationManager?.getUserLocation().catch(() => null);
            
            if (userLocation && window.DistanceCalculator) {
                events = events.map(evt => {
                    const distance = window.DistanceCalculator.haversine(
                        userLocation.latitude, userLocation.longitude,
                        evt.latitude, evt.longitude
                    );
                    return {
                        ...evt,
                        distance_km: parseFloat(distance.toFixed(2)),
                        distance_formatted: window.DistanceCalculator.format(distance)
                    };
                });
            }
        } catch (error) {
            console.warn('⚠️ Erreur calcul distance:', error);
        }
    }
    
    // 5. Trier
    events.sort((a, b) => {
        switch (this.sortBy) {
            case 'distance':
                return (a.distance_km || 0) - (b.distance_km || 0);
            case 'name':
                return (a.titre || '').localeCompare(b.titre || '');
            case 'date':
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            case 'status':
                return (a.status || '').localeCompare(b.status || '');
            default:
                return 0;
        }
    });
    
    return events;
}

  async getHTML(events) {
    const stats = this.getStats(events);
    const cardsHTML = events.length > 0 
        ? await this.getCardsHTML(events) 
        : this.getEmptyStateHTML();
    
    return `
      <section class="tab-panel active">
        
        <div class="panel-header-centered">
          <h2>Gestion des Événements</h2>          
          
          <div class="quick-stats">
            ${this.createStatItem('all', stats.total, 'Total')}
            ${this.createStatItem('pending', stats.pending, 'En attente')}
            ${this.createStatItem('approved', stats.approved, 'Validés')}
            ${this.createStatItem('local', stats.local, 'Locaux')}
          </div>
        </div>
        
        <div class="toolbar-section">
  <div class="toolbar-left">
    <div class="search-container">
      <input type="text" class="search-input" id="search-events"
             placeholder="Rechercher un événement ou établissement..."
             value="${this.searchQuery}">
      <span class="search-icon">${DashboardIcons.search}</span>
    </div>
  </div>
  
  <div class="toolbar-right">
    <!-- Establishment filter -->
    <select class="establishment-select" id="establishment-filter-events">
      <option value="">Tous les établissements</option>
      ${this.establishments.map(estab => `
        <option value="${estab.id}" ${this.establishmentFilter === estab.id ? 'selected' : ''}>
          ${estab.nom}
        </option>
      `).join('')}
    </select>
    
    <!-- Distance filter (désactivé si établissement sélectionné) -->
    <select class="distance-select" id="distance-filter-events" 
            ${this.establishmentFilter ? 'disabled' : ''}>
      <option value="20" ${this.distanceFilter===20?'selected':''}>Dans 20 km</option>
      <option value="50" ${this.distanceFilter===50?'selected':''}>Dans 50 km</option>
      <option value="100" ${this.distanceFilter===100?'selected':''}>Dans 100 km</option>
    </select>
    
    <!-- Sort by -->
    <select class="sort-select" id="sort-events">
      <option value="distance" ${this.sortBy==='distance'?'selected':''}>Trier par distance</option>
      <option value="name" ${this.sortBy==='name'?'selected':''}>Trier par nom</option>
      <option value="date" ${this.sortBy==='date'?'selected':''}>Trier par date</option>
      <option value="status" ${this.sortBy==='status'?'selected':''}>Trier par statut</option>
    </select>
    
    <div class="toolbar-actions">
      <button class="btn-toolbar" id="refresh-events" title="Actualiser">
        ${DashboardIcons.refresh}
      </button>
      <button class="btn-toolbar btn-primary" id="create-event" title="Nouvel événement">
        ${DashboardIcons.add} Nouveau
      </button>
    </div>
  </div>
</div>
        
        <div class="establishments-grid">
          ${cardsHTML}
        </div>
      </section>
    `;
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

  getStats(events) {
    return {
      total: events.length,
      pending: events.filter(e => e.status === 'pending').length,
      approved: events.filter(e => e.status === 'approved').length,
      local: events.filter(e => e.status === 'local' || !e.supabase_synced).length
    };
  }

  async getCardsHTML(events) {
    const cards = events.map(async (evt) => {
        const originInfo = this.getItemOriginInfo(evt);
        const photoUrl = await this.getPhotoUrl(evt);
        const eventDate = evt.date_debut ? new Date(evt.date_debut) : null;
        const dateStr = eventDate ? eventDate.toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        }) : 'N/A';
        
        const establishment = this.establishments.find(e => e.id === evt.establishment_id);
        
        // Distance badge
        let distanceHTML = '';
        if (evt.distance_km !== undefined) {
            const distanceFormatted = evt.distance_km < 1 
                ? `${Math.round(evt.distance_km * 1000)} m`
                : `${evt.distance_km.toFixed(1)} km`;
            
            distanceHTML = `
                <div class="card-distance-badge bottom-left">
                    📍 ${distanceFormatted}
                </div>
            `;
        }
        
        return `
            <article class="establishment-card" data-id="${evt.id}">
                
                <div class="card-photo-section" onclick="AdminDashboardInstance.openPublicEvent('${evt.id}')">
                    ${photoUrl
                        ? `<img src="${photoUrl}" alt="${evt.titre}" class="card-photo" loading="lazy">`
                        : `<div class="card-photo-placeholder">
                             <span class="placeholder-icon">🎭</span>
                           </div>`}
                    
                    <div class="card-status-dot ${originInfo.class}" title="${originInfo.tooltip}"></div>
                    ${distanceHTML}
                </div>

                <div class="card-info-section-centered">
                    <h3 class="card-title">${evt.titre || 'Sans titre'}</h3>
                    <p class="card-type">${evt.category || '–'}</p>
                    <p class="card-address">${establishment?.nom || 'Lieu non spécifié'}</p>
                    
                    <div class="card-meta">
                        <span class="meta-item">📅 ${dateStr}</span>
                        ${evt.facebook_url ? `<span class="meta-item">📘 Facebook</span>` : ''}
                        ${evt.bandcamp_url ? `<span class="meta-item">🎵 Bandcamp</span>` : ''}
                    </div>
                    
                    <div class="card-details">
                        ${evt.description ? `
                            <div class="detail-item">
                                <span class="detail-value">${evt.description.substring(0, 80)}${evt.description.length > 80 ? '...' : ''}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- FAB Delete -->
                <button class="card-fab-delete" data-action="delete" data-id="${evt.id}" title="Supprimer">
                    ${DashboardIcons.delete}
                </button>

                <!-- FAB Edit -->
                <button class="card-fab-edit" data-action="edit" data-id="${evt.id}" title="Modifier">
                    ${DashboardIcons.edit}
                </button>
                
            </article>
        `;
    });

    const htmlArray = await Promise.all(cards);
    return htmlArray.join('');
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
    if (item.photo_url && item.supabase_synced) {
        return item.photo_url;
    }
    
    // ✅ PRIORITÉ 3 : Aucune photo
    return null;
}


  getEmptyStateHTML() {
    const messages = {
      'all': { icon: DashboardIcons.emptyBox, title: 'Aucun événement', message: 'Commencez par créer votre premier événement' },
      'pending': { icon: DashboardIcons.emptyBox, title: 'Aucun événement en attente', message: 'Tous les événements ont été traités' },
      'approved': { icon: DashboardIcons.emptyBox, title: 'Aucun événement validé', message: 'Validez des événements pour les voir ici' },
      'local': { icon: DashboardIcons.emptyBox, title: 'Aucun événement local', message: 'Les événements non synchronisés apparaîtront ici' }
    };
    
    const config = messages[this.filter] || messages['all'];
    
    return `
      <div class="empty-state">
        <div class="empty-icon">${config.icon}</div>
        <h3>${config.title}</h3>
        <p>${config.message}</p>
        ${this.filter === 'all' ? `
          <button class="btn-add-first" id="create-event-empty">
            ✨ Créer le premier événement
          </button>
        ` : `
          <button class="btn-secondary" data-filter="all">
            Voir tous les événements
          </button>
        `}
      </div>
    `;
  }

  setupEventListeners(container) {
    // Stat filters
    container.querySelectorAll('.stat-item').forEach(item => {
        item.addEventListener('click', () => {
            this.filter = item.dataset.filter;
            TabCacheManager.updateFilter('events', this.filter, this.sortBy);
            this.refreshView();
        });
    });

    // Search - Dual mode (événements OU établissements)
    const searchInput = container.querySelector('#search-events');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            
            // Auto-détecte si c'est une recherche établissement
            // (Optionnel: peut chercher les 2)
            TabCacheManager.updateSearch('events', this.searchQuery);
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.refreshView(), 300);
        });
    }

    // Establishment filter - RÉINITIALISE distance
    const establishmentSelect = container.querySelector('#establishment-filter-events');
    if (establishmentSelect) {
        establishmentSelect.addEventListener('change', (e) => {
            this.establishmentFilter = e.target.value || null;
            
            // Réinitialiser distance à 20km quand établissement sélectionné
            if (this.establishmentFilter) {
                this.distanceFilter = 20;
                console.log(`🏢 Établissement sélectionné: ${this.establishmentFilter}`);
            } else {
                console.log('🏢 Établissement réinitialisé');
            }
            
            this.refreshView();
        });
    }

    // Distance filter (désactivé si établissement sélectionné)
    const distanceSelect = container.querySelector('#distance-filter-events');
    if (distanceSelect) {
        distanceSelect.addEventListener('change', (e) => {
            this.distanceFilter = parseInt(e.target.value);
            console.log(`📍 Distance filter changé: ${this.distanceFilter}km`);
            this.refreshView();
        });
    }

    // Sort
    const sortSelect = container.querySelector('#sort-events');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            TabCacheManager.updateFilter('events', this.filter, this.sortBy);
            this.refreshView();
        });
    }

    // Refresh button
    const refreshBtn = container.querySelector('#refresh-events');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            this.dashboard.forceRefresh();
        });
    }

    // Create buttons
    const createBtn = container.querySelector('#create-event');
    const createEmptyBtn = container.querySelector('#create-event-empty');
    [createBtn, createEmptyBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                this.dashboard.createEvent();
            });
        }
    });

    
    // Card delegation
container.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    
    const action = actionBtn.dataset.action;
    const id = actionBtn.dataset.id;
    
    if (action === 'edit') {
        this.dashboard.editEvent(id);
    } else if (action === 'delete') {
        this.dashboard.deleteEvent(id);
    }
});
}

  refreshView() {
    const container = document.getElementById('tab-content');
    if (container) this.render(container);
  }

  cleanup() {
    // NE PAS révoquer les blob URLs
    // Les garder vivants tant que l'app est active
    
    if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
    }
    
    console.log('Cleanup EventTab - pool conservé');
}
}

export default AdminEventTab;