/**
 * 👁️ PUBLIC PAGE - Liste des événements publics
 * MVP : Affiche les événements approved
 */

import IndexedDBManager from '../../services/IndexedDBManager.js';
import SyncEngine from '../../services/SyncEngine.js';
import '../../modals/AuthModal.js';


class PublicPage {
  constructor() {
    this.container = null;
    this.events = [];
    this.establishments = new Map();
    this.filter = 'all'; // all, today, week, month
    this.searchQuery = '';
    this.userLocation = null;
    
    console.log('👁️ PublicPage créée');
  }

  async init() {
    console.log('👁️ Initialisation PublicPage...');
    
    this.container = document.getElementById('app');
    if (!this.container) throw new Error('Container #app introuvable');

    await IndexedDBManager.init();
    
    // Charger la position utilisateur
    await this.loadUserLocation();
    
    // Sync données publiques
    await this.syncPublicData();
    
    // Charger événements
    await this.loadEvents();
    
    this.render();
  }

  async loadUserLocation() {
    try {
      if (window.LocationManager) {
        this.userLocation = await window.LocationManager.getUserLocation();
        console.log('📍 Position:', this.userLocation?.city);
      }
    } catch (error) {
      console.warn('⚠️ Position non disponible:', error);
    }
  }

  async syncPublicData() {
    try {
      console.log('🔄 Sync données publiques...');
      
      // Récupérer événements approved de Supabase
      const { data: events } = await window.supabaseInstance
        .from('events')
        .select('*')
        .eq('status', 'approved')
        .gte('date', new Date().toISOString().split('T')[0]) // Événements futurs
        .order('date', { ascending: true })
        .limit(50);
      
      if (events) {
        for (const event of events) {
          await IndexedDBManager.put('events', event);
        }
        console.log(`✅ ${events.length} événements approved`);
      }
      
      // Récupérer établissements approved
      const { data: establishments } = await window.supabaseInstance
        .from('establishments')
        .select('*')
        .eq('status', 'approved');
      
      if (establishments) {
        for (const estab of establishments) {
          await IndexedDBManager.put('establishments', estab);
          this.establishments.set(estab.id, estab);
        }
        console.log(`✅ ${establishments.length} établissements approved`);
      }
      
    } catch (error) {
      console.error('❌ Erreur sync:', error);
    }
  }

  async loadEvents() {
    try {
      // Charger depuis IndexedDB
      let events = await IndexedDBManager.getAll('events');
      
      // Filtrer approved uniquement
      events = events.filter(e => e.status === 'approved');
      
      // Filtrer futurs uniquement
      const today = new Date().toISOString().split('T')[0];
      events = events.filter(e => e.date >= today);
      
      // Appliquer recherche
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        events = events.filter(e => 
          e.titre?.toLowerCase().includes(query) ||
          e.description?.toLowerCase().includes(query)
        );
      }
      
      // Appliquer filtre temporel
      if (this.filter !== 'all') {
        events = this.applyTimeFilter(events);
      }
      
      // Calculer distances si position disponible
      if (this.userLocation && window.DistanceCalculator) {
        events = events.map(event => {
          const estab = this.establishments.get(event.establishment_id);
          if (estab?.latitude && estab?.longitude) {
            const distance = window.DistanceCalculator.haversine(
              this.userLocation.latitude,
              this.userLocation.longitude,
              estab.latitude,
              estab.longitude
            );
            return { ...event, distance_km: parseFloat(distance.toFixed(1)) };
          }
          return event;
        });
        
        // Trier par distance
        events.sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));
      } else {
        // Trier par date
        events.sort((a, b) => new Date(a.date) - new Date(b.date));
      }
      
      this.events = events;
      console.log(`✅ ${events.length} événements chargés`);
      
    } catch (error) {
      console.error('❌ Erreur chargement:', error);
      this.events = [];
    }
  }

  applyTimeFilter(events) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    switch (this.filter) {
      case 'today':
        return events.filter(e => e.date === today);
      
      case 'week': {
        const weekLater = new Date(now);
        weekLater.setDate(weekLater.getDate() + 7);
        return events.filter(e => e.date <= weekLater.toISOString().split('T')[0]);
      }
      
      case 'month': {
        const monthLater = new Date(now);
        monthLater.setMonth(monthLater.getMonth() + 1);
        return events.filter(e => e.date <= monthLater.toISOString().split('T')[0]);
      }
      
      default:
        return events;
    }
  }

  render() {
    if (!this.container) return;
    
    this.container.innerHTML = this.getHTML();
    this.setupEventListeners();
  }

  getHTML() {
    return `
      <div class="public-page">
        
        <!-- Header -->
        <header class="public-header">
          <div class="header-brand">
            <img src="/public/logos/bk-logo.png" alt="Barzik" class="brand-logo">
            <h1 class="brand-title">Barzik</h1>
          </div>
          
          <div class="header-actions">
            <button class="btn-icon" id="location-btn" title="Ma position">
              📍
            </button>
            <button class="btn-primary" id="login-btn">
              Connexion
            </button>
          </div>
        </header>

        <!-- Filtres -->
        <section class="filters-section">
          <div class="search-bar">
            <input 
              type="text" 
              id="search-events" 
              class="search-input" 
              placeholder="Rechercher un événement..."
              value="${this.searchQuery}"
            >
          </div>
          
          <div class="time-filters">
            <button class="filter-btn ${this.filter === 'all' ? 'active' : ''}" data-filter="all">
              Tous
            </button>
            <button class="filter-btn ${this.filter === 'today' ? 'active' : ''}" data-filter="today">
              Aujourd'hui
            </button>
            <button class="filter-btn ${this.filter === 'week' ? 'active' : ''}" data-filter="week">
              Cette semaine
            </button>
            <button class="filter-btn ${this.filter === 'month' ? 'active' : ''}" data-filter="month">
              Ce mois
            </button>
          </div>
        </section>

        <!-- Liste événements -->
        <main class="events-list">
          ${this.events.length > 0 ? this.getEventsHTML() : this.getEmptyStateHTML()}
        </main>

        <!-- Footer -->
        <footer class="public-footer">
          <div class="footer-content">
            <p>© 2025 Barzik - Agenda Live Music</p>
            <div class="footer-links">
              <a href="#" id="create-account-btn">Créer un compte</a>
              <a href="#">À propos</a>
            </div>
          </div>
        </footer>
        
      </div>
    `;
  }

  getEventsHTML() {
    return this.events.map(event => {
      const estab = this.establishments.get(event.establishment_id);
      const dateObj = new Date(event.date);
      const dateFormatted = dateObj.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
      
      return `
        <article class="event-card" data-id="${event.id}">
          <div class="event-photo">
            ${event.photo_url 
              ? `<img src="${event.photo_url}" alt="${event.titre}">` 
              : '<div class="photo-placeholder">🎵</div>'}
          </div>
          
          <div class="event-info">
            <div class="event-header">
              <h3 class="event-title">${event.titre}</h3>
              <span class="event-category">${this.getCategoryIcon(event.category)}</span>
            </div>
            
            <div class="event-meta">
              <span class="event-date">📅 ${dateFormatted}</span>
              <span class="event-time">🕐 ${event.time || '20h00'}</span>
              ${event.distance_km ? `<span class="event-distance">📍 ${event.distance_km} km</span>` : ''}
            </div>
            
            ${estab ? `
              <div class="event-venue">
                📍 ${estab.nom} • ${estab.ville}
              </div>
            ` : ''}
            
            ${event.price !== undefined ? `
              <div class="event-price">
                ${event.price === 0 ? '🎫 Gratuit' : `🎫 ${event.price}€`}
              </div>
            ` : ''}
          </div>
        </article>
      `;
    }).join('');
  }

  getEmptyStateHTML() {
    return `
      <div class="empty-state">
        <div class="empty-icon">🎵</div>
        <h3>Aucun événement à venir</h3>
        <p>Revenez bientôt pour découvrir les prochains concerts !</p>
      </div>
    `;
  }

  getCategoryIcon(category) {
    const icons = {
      'concert': '🎸',
      'djset': '🎧',
      'karaoke': '🎤',
      'jam': '🎹',
      'festival': '🎪'
    };
    return icons[category] || '🎵';
  }

  setupEventListeners() {
    // Connexion
    document.getElementById('login-btn')?.addEventListener('click', () => {
      window.AuthModal.open('login');
    });

    // Créer compte
    document.getElementById('create-account-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.AuthModal.open('register');
    });

    // Géolocalisation
    document.getElementById('location-btn')?.addEventListener('click', async () => {
      await this.handleLocationRefresh();
    });

    // Recherche
    document.getElementById('search-events')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => this.refreshEvents(), 300);
    });

    // Filtres temporels
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.filter = btn.dataset.filter;
        this.refreshEvents();
      });
    });

    // Clic sur événement (futur)
    document.querySelectorAll('.event-card').forEach(card => {
      card.addEventListener('click', () => {
        const eventId = card.dataset.id;
        // TODO: Ouvrir PublicEventModal
        console.log('📌 Ouvrir événement:', eventId);
      });
    });
  }

  async handleLocationRefresh() {
    try {
      if (window.LocationManager) {
        this.userLocation = await window.LocationManager.refreshLocation();
        await this.refreshEvents();
        alert(`📍 Position mise à jour : ${this.userLocation.city}`);
      }
    } catch (error) {
      alert('❌ Impossible de récupérer votre position');
    }
  }

  async refreshEvents() {
    await this.loadEvents();
    this.render();
  }

  cleanup() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }
}

window.PublicPage = PublicPage;
export default PublicPage;