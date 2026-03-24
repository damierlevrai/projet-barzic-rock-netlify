/**
 * 🎭 EVENT MODAL - VERSION OPTIMISÉE
 * Utilise BaseModal comme template method pattern
 * Config déclarative, métier spécifique uniquement
 * 
 * FIXES:
 * - YouTube buttons selectors kebab-case uniforme
 * - Admin assign organisateur + établissement
 * - Adresse custom avec géocodage
 * - Photo naming clarifié (existingPhotoId vs currentNewPhotoId)
 */

import BaseModal, { FormIcons, SocialIcons } from './BaseModal.js';
import IndexedDBManager from '../services/IndexedDBManager.js';
import GeocodingService from '../services/GeocodingService.js';
import Auth from '../services/auth.js';

export class EventModal extends BaseModal {
  constructor() {
    super();
    this.modalId = 'event-modal';
    this.photoBucket = 'event-photos';

    this.isOrgaContext = false;
    this.isAdminContext = false;
    this.currentUserEstablishments = [];
    this.allEstablishments = [];
    this.existingCategories = [];
    this.organizersForAdmin = [];
    this.youtubeUrls = [];
    this.isGeocodingAddress = false;
  }

  /**
   * 🎬 OPEN - Ouvre le modal
   */
  async open(event = null) {
    try {
        this.currentData = event || {};
        this.isEdit = !!event;
        this.existingPhotoId = event?.photo_id || null;
        this.currentNewPhotoId = null;

        this.detectContext();
        
        await this.loadEstablishments();
        await this.loadCategories();
        await this.loadOrganizers();
        
        this.initializeYouTubeUrls();

        console.log(`EventModal: ${this.isEdit ? 'Édition' : 'Création'}`);

        await super.open(event);
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        this.setupYouTubeDynamic();
        this.setupAddressGeocoding();
        
    } catch (error) {
        console.error('❌ ERREUR DANS EVENTMODAL.OPEN:', error);
        throw error;  // Laisser remonter l'erreur
    }
}

  /**
   * 🔍 DETECT CONTEXT - Déterminer le contexte utilisateur
   */
  detectContext() {
    const user = this.getCurrentUser();
    this.isOrgaContext = ['organizer', 'user'].includes(user?.role);
    this.isAdminContext = user?.role === 'admin';
  }

  /**
   * 📍 LOAD ESTABLISHMENTS - Charger les établissements disponibles
   */
  async loadEstablishments() {
    try {
      const all = await IndexedDBManager.getAll('establishments');
      const approved = all.filter(e => e.status === 'approved');

      if (this.isOrgaContext) {
        const user = this.getCurrentUser();
        this.currentUserEstablishments = approved.filter(e => 
          e.owner_id === user.id
        );
        console.log(`📍 Établissements orga: ${this.currentUserEstablishments.length}`);
      } else if (this.isAdminContext) {
        this.allEstablishments = approved;
        console.log(`📍 Établissements admin: ${this.allEstablishments.length}`);
      }
    } catch (error) {
      console.error('Erreur chargement établissements:', error);
    }
  }

  /**
   * 🎵 LOAD CATEGORIES - Charger les catégories d'événements
   */
  async loadCategories() {
    try {
      const events = await IndexedDBManager.getAll('events');
      
      const categories = [...new Set(events.map(e => e.category).filter(Boolean))].sort();
      
      this.existingCategories = categories.length > 0 
        ? categories 
        : ['concert', 'djset', 'jam session', 'open mic', 'battle', 'showcase', 'festival', 'soirée'];
      
      console.log(`🎵 Catégories chargées: ${this.existingCategories.length}`);
      
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
      this.existingCategories = ['concert', 'djset', 'jam session', 'open mic', 'battle'];
    }
  }

  /**
   * 👥 LOAD ORGANIZERS - Charger les organisateurs pour admin
   */
  async loadOrganizers() {
    try {
      const profiles = await IndexedDBManager.getAll('profiles');
      this.organizersForAdmin = profiles.filter(p =>
        p.role === 'organizer' && p.is_active !== false
      );
      console.log(`👥 Organisateurs chargés: ${this.organizersForAdmin.length}`);
    } catch (error) {
      console.error('Erreur chargement organisateurs:', error);
      this.organizersForAdmin = [];
    }
  }

  async geocodeEstablishment(prepared) {
    if (!prepared.adresse || !prepared.ville) {
        console.warn('⚠️ Adresse incomplète, geocoding ignoré');
        return prepared;
    }

    try {
        if (!window.GeocodingService) {
            console.warn('⚠️ GeocodingService non disponible');
            return prepared;
        }

        console.log('🗺️ Geocoding:', {
            adresse: prepared.adresse,
            ville: prepared.ville,
            code_postal: prepared.code_postal
        });
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Geocoding timeout')), 5000)
        );

        const result = await Promise.race([
            window.GeocodingService.geocodeAddress(
                prepared.adresse,
                prepared.ville,
                prepared.code_postal
            ),
            timeoutPromise
        ]);

        if (result) {
            prepared.latitude = result.latitude;
            prepared.longitude = result.longitude;
            prepared.adresse_complete = prepared.adresse;
            
            console.log(`✅ Geocoding réussi:`);
            console.log(`  - Coordonnées: ${result.latitude}, ${result.longitude}`);
            console.log(`  - Source: ${result.source}`);
            console.log(`  - Adresse: ${prepared.adresse}`);
            
            if (result.fallback) {
                console.warn('⚠️ Geocoding en fallback (coordonnées approximatives)');
            }
        }
        
    } catch (error) {
        console.warn('⚠️ Geocoding échoué:', error.message);
        prepared.adresse_complete = prepared.adresse;
        prepared.latitude = 46.227638;
        prepared.longitude = 2.213749;
        console.log('📍 Utilisation coordonnées par défaut (France)');
        console.log('  - Adresse conservée:', prepared.adresse);
    }

    return prepared;
}

  /**
   * ▶️ INITIALIZE YOUTUBE URLS - Initialiser les URLs YouTube
   */
  initializeYouTubeUrls() {
    this.youtubeUrls = [];
    
    if (this.currentData.youtube_url1) this.youtubeUrls.push(this.currentData.youtube_url1);
    if (this.currentData.youtube_url2) this.youtubeUrls.push(this.currentData.youtube_url2);
    if (this.currentData.youtube_url3) this.youtubeUrls.push(this.currentData.youtube_url3);
    
    if (this.youtubeUrls.length === 0) {
      this.youtubeUrls.push('');
    }
  }

  /**
   * 📅 FORMAT DATES - Formatter les dates pour les inputs
   */
  formatDates(data) {
    let dateValue = '', timeValue = '', dateFinValue = '';
    
    if (data.date_debut) {
      const eventDate = new Date(data.date_debut);
      dateValue = eventDate.toISOString().split('T')[0];
      timeValue = eventDate.toTimeString().split(' ')[0].substring(0, 5);
    }
    
    if (data.date_fin) {
      const endDate = new Date(data.date_fin);
      dateFinValue = endDate.toISOString().split('T')[0];
    }
    
    return { dateValue, timeValue, dateFinValue };
  }

  /**
   * ⚙️ GET FORM FIELDS CONFIG - Configuration des champs
   */
  getFormFieldsConfig() {
    const data = this.currentData || {};
    const { dateValue, timeValue, dateFinValue } = this.formatDates(data);
    
    return [
      {
        id: 'titre',
        name: 'titre',
        validation: 'required',
        value: data.titre || '',
        placeholder: 'Concert Rock, Jam Session...'
      },
      {
        id: 'category',
        name: 'category',
        validation: 'required',
        value: data.category || '',
        placeholder: 'Concert, DJ Set, Jam Session...',
        datalist: `
          <option value="Concert">
          <option value="DJ Set">
          <option value="Jam Session">
          <option value="Open Mic">
          <option value="Battle">
          <option value="Showcase">
          <option value="Festival">
          <option value="Soirée à thème">
          <option value="Karaoké">
          <option value="Théâtre musical">
          <option value="Stand-up">
        `
      },
      {
        id: 'establishment',
        type: 'custom',
        renderer: () => this.createEstablishmentField()
      },
      {
        id: 'adresse',
        value: data.adresse || '',
        placeholder: 'Si différente de l\'établissement...',
        validation: 'optional'
      },
      {
        id: 'ville',
        value: data.ville || '',
        placeholder: 'Ville (si différente)',
        validation: 'optional'
      },
      {
        id: 'code_postal',
        name: 'code_postal',
        value: data.code_postal || '',
        placeholder: 'Code postal',
        validation: 'optional'
      },
      {
        id: 'description',
        name: 'description',
        type: 'textarea',
        value: data.description || '',
        placeholder: 'Décrivez votre événement, artistes, programme...',
        validation: 'optional'
      },
      {
        id: 'date',
        name: 'date',
        type: 'date',
        value: dateValue,
        validation: 'required'
      },
      {
        id: 'time',
        name: 'time',
        type: 'time',
        value: timeValue || '20:00',
        validation: 'required'
      },
      {
        id: 'date_fin',
        name: 'date_fin',
        type: 'date',
        value: dateFinValue,
        validation: 'optional'
      },
      {
        id: 'youtube',
        type: 'custom',
        renderer: () => this.createYouTubeSection()
      },
      {
        id: 'socials',
        type: 'custom',
        renderer: () => this.createSocialsSection()
      }
    ];
  }

  /**
   * ✅ GET VALIDATION CONFIG - Configuration validation
   */
  getValidationConfig() {
    const config = [
      { id: 'titre', name: 'titre', validation: 'required', label: 'Le titre' },
      { id: 'category', name: 'category', validation: 'required', label: 'La catégorie' },
      { id: 'date', name: 'date', validation: 'required', label: 'La date' },
      { id: 'time', name: 'time', validation: 'required', label: 'L\'heure' },
      { id: 'adresse', name: 'adresse', validation: 'optional' },
      { id: 'ville', name: 'ville', validation: 'optional' },
      { id: 'code_postal', name: 'code_postal', validation: 'optional' }
    ];

    if (!this.isOrgaContext || this.currentUserEstablishments.length > 1) {
      config.push({ 
        id: 'establishment', 
        name: 'establishment_id', 
        validation: 'required', 
        label: 'Le lieu' 
      });
    }

    return config;
  }

  validateForm() {
  if (!super.validateForm()) return false;

  const establishmentInput = this.modalElement?.querySelector(`#${this.modalId}-establishment`);
  console.log('🎯 DEBUG validateForm - establishment input:', {
    element: !!establishmentInput,
    value: establishmentInput?.value,
    name: establishmentInput?.name
  });

  const hasEstablishment = establishmentInput?.value?.trim();
  const adresseInput = this.modalElement?.querySelector(`#${this.modalId}-adresse`);
  const hasAddress = adresseInput?.value?.trim();

  console.log('🎯 DEBUG - hasEstablishment:', hasEstablishment, 'hasAddress:', hasAddress);

  if (!hasEstablishment && !hasAddress) {
    this.showNotification('❌ Sélectionnez un établissement ou entrez une adresse', 'error');
    return false;
  }

  return true;
}

  /**
   * 📊 GETTERS - Abstracts implementation
   */

  getStoreName() { 
    return 'events'; 
  }

  getTitle() { 
    return this.isEdit ? this.currentData.titre : 'Nouvel Événement'; 
  }

  getCacheTabName() { 
    return 'events'; 
  }

  
  getSuccessMessage(isEdit) {
    return `Événement ${isEdit ? 'modifié' : 'créé'} !`;
  }

  /**
   * 🎨 CREATE ESTABLISHMENT FIELD - Rendu custom établissement
   */
  createEstablishmentField() {
    const data = this.currentData || {};
    const fieldId = `${this.modalId}-establishment`;
    
    if (this.isOrgaContext) {
      if (this.currentUserEstablishments.length === 0) {
        return `
          <div class="modern-field-container">
            <div class="modern-establishment-warning">
              <div class="field-icon">⚠️</div>
              <div class="warning-text">
                <p><strong>Créez d'abord votre établissement</strong></p>
                <small>Rendez-vous dans "Mes Établissements"</small>
              </div>
            </div>
          </div>
        `;
      }
      
      if (this.currentUserEstablishments.length === 1) {
        const estab = this.currentUserEstablishments[0];
        return `
          <div class="modern-field-container">
            <div class="modern-establishment-readonly">
              <div class="field-icon">🏢</div>
              <div class="establishment-info">
                <strong>${this.escapeHtml(estab.nom)}</strong>
                <small>${this.escapeHtml(estab.type)}</small>
              </div>
            </div>
            <input type="hidden" name="establishment_id" value="${estab.id}">
          </div>
        `;
      }
      
      return `
        <div class="modern-field-container" data-field="establishment_id">
          <div class="modern-select-field">
            <div class="field-icon">🏢</div>
            <select id="${fieldId}" name="establishment_id" class="modern-field-input" required>
              <option value="">Choisir un lieu</option>
              ${this.currentUserEstablishments.map(e => `
                <option value="${e.id}" ${data.establishment_id === e.id ? 'selected' : ''}>
                  ${this.escapeHtml(e.nom)} (${this.escapeHtml(e.type)})
                </option>
              `).join('')}
            </select>
            <div class="field-validation" data-validation="${fieldId}">
              <span class="validation-icon"></span>
            </div>
          </div>
        </div>
      `;
    }

    // ADMIN - tous les établissements
    const establishments = this.allEstablishments || [];
    
    return `
      <div class="modern-field-container" data-field="establishment_id">
        <div class="modern-select-field">
          <div class="field-icon">🏢</div>
          <select id="${fieldId}" name="establishment_id" class="modern-field-input" required>
            <option value="">Choisir un lieu</option>
            ${establishments.map(e => `
              <option value="${e.id}" ${data.establishment_id === e.id ? 'selected' : ''}>
                ${this.escapeHtml(e.nom)} (${this.escapeHtml(e.type)})
              </option>
            `).join('')}
          </select>
          <div class="field-validation" data-validation="${fieldId}">
            <span class="validation-icon"></span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * ▶️ CREATE YOUTUBE SECTION - Section YouTube avec add/remove
   */
  createYouTubeSection() {
    return `
      <div id="youtube-container" class="modern-youtube-container">
        ${this.createYouTubeFields()}
      </div>
    `;
  }

  /**
   * ▶️ CREATE YOUTUBE FIELDS - Champs YouTube avec boutons
   * FIX: Selectors kebab-case uniforme
   */
  createYouTubeFields() {
    return this.youtubeUrls.map((url, index) => {
      const isFirst = index === 0;
      const canAddMore = this.youtubeUrls.length < 3;
      
      return `
        <div class="youtube-field-group" data-youtube-index="${index}">
          ${this.createFormField({
            id: `youtube_url${index + 1}`,
            name: `youtube_url${index + 1}`,
            type: 'url',
            value: url,
            placeholder: 'URL YouTube...'
          })}
          ${!isFirst ? `
            <button type="button" class="youtube-remove-btn" data-youtube-action="remove" data-index="${index}" title="Supprimer cette vidéo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          ` : (canAddMore ? `
            <button type="button" class="youtube-add-btn" data-youtube-action="add" title="Ajouter une vidéo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          ` : '')}
        </div>
      `;
    }).join('');
  }

  /**
   * 🎬 SETUP YOUTUBE DYNAMIC - Ajouter/Supprimer vidéos dynamiquement
   * FIX: data-youtube-action au lieu de class
   */
  setupYouTubeDynamic() {
    const container = this.modalElement?.querySelector('#youtube-container');
    if (!container) return;

    container.addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-youtube-action="add"]');
      const removeBtn = e.target.closest('[data-youtube-action="remove"]');

      if (addBtn) {
        e.preventDefault();
        this.addYouTubeUrl();
      }

      if (removeBtn) {
        e.preventDefault();
        const index = parseInt(removeBtn.dataset.index);
        this.removeYouTubeUrl(index);
      }
    });
  }

  /**
   * ➕ ADD YOUTUBE URL - Ajouter un champ YouTube
   */
  addYouTubeUrl() {
    if (this.youtubeUrls.length >= 3) return;
    
    this.saveYouTubeValues();
    this.youtubeUrls.push('');
    this.refreshYouTubeFields();
  }

  /**
   * ➖ REMOVE YOUTUBE URL - Supprimer un champ YouTube
   */
  removeYouTubeUrl(index) {
    if (this.youtubeUrls.length <= 1) return;
    
    this.saveYouTubeValues();
    this.youtubeUrls.splice(index, 1);
    this.refreshYouTubeFields();
  }

  /**
   * 💾 SAVE YOUTUBE VALUES - Sauvegarder valeurs YouTube en mémoire
   */
  saveYouTubeValues() {
    this.youtubeUrls = this.youtubeUrls.map((url, index) => {
      const input = document.getElementById(`${this.modalId}-youtube_url${index + 1}`);
      return input ? input.value : url;
    });
  }

  /**
   * 🔄 REFRESH YOUTUBE FIELDS - Rafraîchir affichage YouTube
   */
  refreshYouTubeFields() {
    const container = this.modalElement?.querySelector('#youtube-container');
    if (container) {
      container.innerHTML = this.createYouTubeFields();
      this.setupYouTubeDynamic();
    }
  }

  /**
   * 📍 SETUP ADDRESS GEOCODING - Géocoder adresse custom au blur
   */
  setupAddressGeocoding() {
    const addressInput = this.modalElement?.querySelector(`#${this.modalId}-adresse`);
    const villeInput = this.modalElement?.querySelector(`#${this.modalId}-ville`);

    if (addressInput && villeInput) {
      villeInput.addEventListener('blur', async () => {
        const adresse = addressInput.value?.trim();
        const ville = villeInput.value?.trim();

        if (adresse && ville && !this.isGeocodingAddress) {
          await this.geocodeEventAddress(adresse, ville);
        }
      });
    }
  }

  /**
   * 🗺️ GEOCODE EVENT ADDRESS - Obtenir lat/lon de l'adresse event
   */
  async geocodeEventAddress(adresse, ville) {
    try {
      this.isGeocodingAddress = true;
      console.log(`🗺️ Géocodage: ${adresse}, ${ville}`);

      const result = await GeocodingService.geocodeAddress(adresse, ville);
      
      if (result) {
        this.currentData.latitude = result.latitude;
        this.currentData.longitude = result.longitude;
        console.log(`✅ Coordonnées obtenues: ${result.latitude}, ${result.longitude}`);
      }
    } catch (error) {
      console.warn('⚠️ Géocodage échoué:', error.message);
    } finally {
      this.isGeocodingAddress = false;
    }
  }

  /**
   * Preparer les donnees avant sauvegarde
   */
  prepareDataBeforeSave(data) {
  const user = this.getCurrentUser();
  const isAdmin = user?.role === 'admin';
  
  console.log('[EVENT] Prepare data:', {
      establishment_id: data.establishment_id,
      admin_owner_id: data.admin_owner_id,
      titre: data.titre
  });

  const dateDebut = new Date(`${data.date}T${data.time}`);
  const dateFin = data.date_fin ? 
                  new Date(`${data.date_fin}T23:59:59`) : 
                  null;

  let ownerId = user.id;

  if (this.isAdminContext && data.admin_owner_id) {
    ownerId = data.admin_owner_id;
  }

  let latitude = this.currentData.latitude || null;
  let longitude = this.currentData.longitude || null;

  if (!data.adresse && data.establishment_id) {
    const estab = [...this.currentUserEstablishments, ...this.allEstablishments]
      .find(e => e.id === data.establishment_id);
    if (estab) {
      latitude = estab.latitude || null;
      longitude = estab.longitude || null;
    }
  }

  return {
    titre: data.titre.trim(),
    category: data.category.trim(),
    date_debut: dateDebut.toISOString(),
    date_fin: dateFin?.toISOString() || null,
    establishment_id: data.establishment_id,
    description: data.description?.trim() || (this.isEdit ? this.currentData.description : null),
    adresse: data.adresse?.trim() || (this.isEdit ? this.currentData.adresse : null),
    ville: data.ville?.trim() || (this.isEdit ? this.currentData.ville : null),
    code_postal: data.code_postal?.trim() || (this.isEdit ? this.currentData.code_postal : null),
    latitude: latitude,
    longitude: longitude,
    facebook_url: data.facebook_url?.trim() || (this.isEdit ? this.currentData.facebook_url : null),
    bandcamp_url: data.bandcamp_url?.trim() || (this.isEdit ? this.currentData.bandcamp_url : null),
    helloasso_url: data.helloasso_url?.trim() || (this.isEdit ? this.currentData.helloasso_url : null),
    youtube_url1: data.youtube_url1?.trim() || (this.isEdit ? this.currentData.youtube_url1 : null),
    youtube_url2: data.youtube_url2?.trim() || (this.isEdit ? this.currentData.youtube_url2 : null),
    youtube_url3: data.youtube_url3?.trim() || (this.isEdit ? this.currentData.youtube_url3 : null),
    owner_id: ownerId,
    creator_id: user.id,
    status: isAdmin ? 'approved' : 'pending',
    created_locally: true
  };
}

  /**
   * 🎨 CREATE SOCIALS SECTION - Rendu custom réseaux
   */
  createSocialsSection() {
    const data = this.currentData || {};
    return `
      <div class="modern-social-grid">
        ${this.createSocialField({
          id: 'facebook',
          name: 'facebook_url',
          value: data.facebook_url || '',
          placeholder: 'facebook.com/events/...'
        })}
        
        ${this.createSocialField({
          id: 'bandcamp',
          name: 'bandcamp_url',
          value: data.bandcamp_url || '',
          placeholder: 'artiste.bandcamp.com'
        })}
        
        ${this.createSocialField({
          id: 'helloasso',
          name: 'helloasso_url',
          value: data.helloasso_url || '',
          placeholder: 'helloasso.com/...'
        })}
      </div>
    `;
  }

  async handlePhotoChanges(prepared) {
  const newPhotoId = this.allowPhotoUpload ? this.getPhotoTempId() : null;
  
  if (this.isEdit && !newPhotoId) {
    prepared.photo_id = this.currentData.photo_id;
    prepared.photo_url = this.currentData.photo_url;
    prepared.photo_hash = this.currentData.photo_hash;
    return;
  }
  
  if (this.isEdit && newPhotoId && newPhotoId !== this.existingPhotoId) {
    await this.cleanupOldPhoto(this.existingPhotoId, this.currentData?.photo_url);
  }
  
  if (newPhotoId) {
    try {
      const photoData = await window.IndexedDBManager?.get('photos', newPhotoId);
      if (photoData?.blob) {
        prepared.photo_hash = await window.PhotoOrchestrator?.calculateHash(photoData.blob);
        prepared.photo_id = newPhotoId;
        
        const isOnline = window.NetworkStatus?.isOnline?.();
        if (isOnline) {
          const uploadResult = await window.PhotoService?.upload(
            { universal: photoData.blob },
            prepared.id,
            'event-photos'  // ← change le bucket pour événements
          );
          if (uploadResult?.photo_url) {
            prepared.photo_url = uploadResult.photo_url;
          }
        } else {
          prepared.photo_url = null;
        }
      }
    } catch (err) {
      console.warn('[PHOTO] Erreur gestion photo:', err);
    }
  }
}
}

// Export singleton
if (!window.EventModal) {
  window.EventModal = new EventModal();
}

export default window.EventModal;