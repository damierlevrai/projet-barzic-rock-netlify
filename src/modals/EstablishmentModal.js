/**
 * 🏢 ESTABLISHMENT MODAL - VERSION OPTIMISÉE
 * Utilise BaseModal comme template method pattern
 * Config déclarative uniquement
 */

import BaseModal, { FormIcons, SocialIcons } from './BaseModal.js';
import IndexedDBManager from '../services/IndexedDBManager.js';
import Auth from '../services/auth.js';
import AddressAutocomplete from '../services/AddressAutocomplete.js';

export class EstablishmentModal extends BaseModal {
  constructor() {
    super();
    this.modalId = 'establishment-modal';
    this.photoBucket = 'establishment-photos';
    
    this.organizersForAdmin = [];
    this.isAdminContext = false;
    this.addressAutocomplete = null;
  }

  /**
   * 🎬 OPEN - Ouvre le modal
   */
  async open(establishment = null) {
    this.currentData = establishment || {};
    this.isEdit = !!establishment;
    this.existingPhotoId = establishment?.photo_id || null;
    this.currentNewPhotoId = null;

    const user = this.getCurrentUser();
    this.isAdminContext = user?.role === 'admin';

    if (this.isAdminContext && !this.isEdit) {
      await this.loadOrganizers();
    }

    console.log(`🏢 Établissement: ${this.isEdit ? 'Édition' : 'Nouveau'}`);

    await super.open(establishment);
  
  setTimeout(() => {
    this.setupAddressAutocomplete();
  }, 100);
}
  
  /**
 * 🏠 SETUP ADDRESS AUTOCOMPLETE
 */
setupAddressAutocomplete() {
  this.addressAutocomplete = new AddressAutocomplete({
    modalId: this.modalId,
    adresseFieldId: 'adresse',
    villeFieldId: 'ville',
    codePostalFieldId: 'code_postal',
    debounceDelay: 500,
    onAddressSelect: (addressData) => {
  console.log('🎯 Address auto-selected:', addressData);
  
  if (addressData.address) {
    const houseNumber = addressData.address.house_number || '';
    const road = addressData.address.road || '';
    const fullAddress = [houseNumber, road].filter(Boolean).join(' ');
    
    if (fullAddress) {
      const adresseInput = document.getElementById(`${this.modalId}-adresse`);
      if (adresseInput) {
        adresseInput.value = fullAddress;
        adresseInput.dispatchEvent(new Event('input', { bubbles: true }));
        adresseInput.dispatchEvent(new Event('blur', { bubbles: true }));
        console.log('📝 Adresse mise à jour:', fullAddress);
      }
    }
  }
}
  });
  
  this.addressAutocomplete.setup();
  console.log('✅ Address autocomplete initialized');
}

  /**
   * 👥 LOAD ORGANIZERS - Charger liste organisateurs pour admin
   */
  async loadOrganizers() {
  try {
    const profiles = await IndexedDBManager.getAll('profiles');
    console.log(`📦 Tous les profiles: ${profiles.length}`);
    console.log('DEBUG profiles:', profiles.map(p => ({ 
      email: p.email, 
      role: p.role, 
      is_active: p.is_active 
    })));
    
    this.organizersForAdmin = profiles.filter(p => {
  const isOrga = p.role === 'organizer';
  const isActive = p.is_active !== false;
  console.log(`  Checking ${p.email}: role=${p.role}, is_active=${p.is_active} → ${isOrga && isActive}`);
  return isOrga && isActive;
});

    
    console.log(`👥 Organisateurs filtrés: ${this.organizersForAdmin.length}`);
    if (this.organizersForAdmin.length > 0) {
      console.log('Orgas trouvés:', this.organizersForAdmin.map(o => `${o.prenom} ${o.nom} (${o.email})`));
    }
  } catch (error) {
    console.error('Erreur chargement organisateurs:', error);
    this.organizersForAdmin = [];
  }
}

  /**
 * 🧹 CLOSE - Override pour cleanup autocomplete
 */
close() {
  // Cleanup autocomplete AVANT d'appeler super.close()
  this.addressAutocomplete?.destroy();
  
  // Appeler close() de BaseModal
  super.close();
}

  /**
   * ⚙️ GET FORM FIELDS CONFIG - Configuration des champs
   */
  getFormFieldsConfig() {
    const data = this.currentData || {};
    
    return [
      {
        id: 'nom',
        validation: 'required',
        value: data.nom || '',
        placeholder: 'Le Rock Bar'
      },
      {
        id: 'type',
        validation: 'required',
        value: data.type || '',
        placeholder: 'Bar, Salle de concert...',
        datalist: `
          <option value="Bar">
          <option value="Bar brasserie">
          <option value="Bar associatif">
          <option value="Salle de concert">
          <option value="Festival">
          <option value="Club">
          <option value="Café-concert">
          <option value="Restaurant concert">
        `
      },

      // ADMIN ASSIGN ORGANISATEUR
      ...(this.isAdminContext && !this.isEdit ? [{
  id: 'owner_for_organizer',
  validation: 'optional',
  value: '',
  placeholder: 'Attribuer à un organisateur...',
  datalist: this.organizersForAdmin.map(o => {
  const displayName = o.displayName || `${o.prenom || ''} ${o.nom || ''}`.trim();
  return `<option value="${displayName} (${o.email})">${displayName} (${o.email})</option>`;
}).join('')
}] : []),

      {
        id: 'description',
        type: 'textarea',
        value: data.description || '',
        placeholder: 'Décrivez l\'établissement, son ambiance, sa programmation...',
        validation: 'optional'
      },
      {
        id: 'adresse',
        validation: 'required',
        value: data.adresse || '',
        placeholder: '12 rue de la Liberté'
      },
      {
        id: 'ville',
        validation: 'required',
        value: data.ville || '',
        placeholder: 'Paris'
      },
      {
        id: 'code_postal',
        name: 'code_postal',
        validation: 'optional',
        value: data.code_postal || '',
        placeholder: '75001'
      },
      {
        id: 'telephone',
        type: 'tel',
        validation: 'phone',
        value: data.telephone || '',
        placeholder: '01 23 45 67 89'
      },
      {
        id: 'email',
        type: 'email',
        validation: 'email',
        value: data.email || '',
        placeholder: 'contact@lerockbar.fr'
      },
      {
        id: 'website',
        type: 'url',
        validation: 'url',
        value: data.website || '',
        placeholder: 'https://www.lerockbar.fr'
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
    return [
      { id: 'nom', validation: 'required', label: 'Le nom' },
      { id: 'type', validation: 'required', label: 'Le type' },
      { id: 'adresse', validation: 'required', label: 'L\'adresse' },
      { id: 'ville', validation: 'required', label: 'La ville' },
      { id: 'email', validation: 'email', label: 'L\'email' },
      { id: 'website', validation: 'url', label: 'Le site web' },
      { id: 'telephone', validation: 'phone', label: 'Le téléphone' }
    ];
  }

  validateForm() {
  const config = this.getValidationConfig();
  let isValid = true;

  config.forEach(fieldConfig => {
    if (!this.validateField(fieldConfig)) {
      isValid = false;
    }
  });

  return isValid;
}

  /**
   * 📊 GETTERS - Abstracts implementation
   */

  getStoreName() { 
    return 'establishments'; 
  }

  getTitle() { 
    return this.isEdit ? this.currentData.nom : 'Nouvel Établissement'; 
  }

  getCacheTabName() { 
    return 'establishments'; 
  }

  
  getSuccessMessage(isEdit) {
    return `Établissement ${isEdit ? 'modifié' : 'créé'} !`;
  }

  /**
   * 🔄 PREPARE DATA BEFORE SAVE - Transformer FormData
   */
  prepareDataBeforeSave(data) {
  let ownerId = this.getCurrentUser().id;

  // ADMIN ASSIGN ORGANISATEUR
  if (this.isAdminContext && data.owner_for_organizer) {
    const match = data.owner_for_organizer.match(/\((.*?)\)/);
    if (match) {
      const email = match[1];
      const organizer = this.organizersForAdmin.find(o => o.email === email);
      if (organizer) {
        ownerId = organizer.id;
      }
    }
  }

    return {
    nom: data.nom.trim(),
    type: data.type.trim(),
    description: data.description?.trim() || (this.isEdit ? this.currentData.description : null),
    adresse: data.adresse.trim(),
    ville: data.ville.trim(),
    code_postal: data.code_postal?.trim() || (this.isEdit ? this.currentData.code_postal : null),
    telephone: data.telephone?.trim() || (this.isEdit ? this.currentData.telephone : null),
    email: data.email?.trim() || (this.isEdit ? this.currentData.email : null),
    website: data.website?.trim() || (this.isEdit ? this.currentData.website : null),
    facebook_url: data.facebook_url?.trim() || (this.isEdit ? this.currentData.facebook_url : null),
    instagram_url: data.instagram_url?.trim() || (this.isEdit ? this.currentData.instagram_url : null),
    city_normalized: this.normalizeCity(data.ville),
    latitude: data.latitude ? parseFloat(data.latitude) : null,
    longitude: data.longitude ? parseFloat(data.longitude) : null,
    owner_id: ownerId
  };
}

/**
 * ✅ VALIDATE FORM - Adresse OBLIGATOIRE pour établissements
 */
validateForm() {
  // Validation parent d'abord
  if (!super.validateForm()) return false;

  // Logique spécifique ESTABLISHMENT : adresse obligatoire
  const adresseInput = this.modalElement?.querySelector(`#${this.modalId}-adresse`);
  
  if (!adresseInput?.value?.trim()) {
    this.showNotification('❌ Adresse obligatoire', 'error');
    return false;
  }

  return true;
}

 /**
 * 🗺️ GEOCODE ADDRESS - Optimisé pour adresses complètes
 * ⭐ Garde TOUJOURS l'adresse saisie par l'utilisateur
 */
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
        
        // TIMEOUT: 5 secondes max (évite les freezes infinis)
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
            // ✅ Assigner les coordonnées
            prepared.latitude = result.latitude;
            prepared.longitude = result.longitude;
            
            // ✅ TOUJOURS utiliser l'adresse saisie par l'utilisateur
            prepared.adresse_complete = prepared.adresse;
            
            console.log(`✅ Geocoding réussi:`);
            console.log(`  - Coordonnées: ${result.latitude}, ${result.longitude}`);
            console.log(`  - Source: ${result.source}`);
            console.log(`  - Adresse: ${prepared.adresse}`);
            
            // Log de fallback si nécessaire
            if (result.fallback) {
                console.warn('⚠️ Geocoding en fallback (coordonnées approximatives)');
            }
        }
        
    } catch (error) {
        // ✅ NE PAS BLOQUER - juste warning
        console.warn('⚠️ Geocoding échoué:', error.message);
        
        // Garder l'adresse saisie par l'utilisateur
        prepared.adresse_complete = prepared.adresse;
        
        // Utiliser coordonnées par défaut (centre France)
        prepared.latitude = 46.227638;
        prepared.longitude = 2.213749;
        
        console.log('📍 Utilisation coordonnées par défaut (France)');
        console.log('  - Adresse conservée:', prepared.adresse);
    }

    return prepared;
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
          placeholder: 'facebook.com/lerockbar'
        })}

        ${this.createSocialField({
          id: 'instagram',
          name: 'instagram_url',
          value: data.instagram_url || '',
          placeholder: 'instagram.com/lerockbar'
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
            this.photoBucket
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
const establishmentModal = new EstablishmentModal();
window.EstablishmentModal = establishmentModal;

export default establishmentModal;