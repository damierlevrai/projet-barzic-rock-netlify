/**
 * 🏠 ADDRESS AUTOCOMPLETE - Autocomplétion d'adresse avec remplissage auto des champs
 * Utilisé par : EstablishmentModal, EventModal
 */

class AddressAutocomplete {
  constructor(options = {}) {
    this.modalId = options.modalId || 'modal';
    this.adresseFieldId = options.adresseFieldId || 'adresse';
    this.villeFieldId = options.villeFieldId || 'ville';
    this.codePostalFieldId = options.codePostalFieldId || 'code_postal';
    this.onAddressSelect = options.onAddressSelect || null;
    this.debounceDelay = options.debounceDelay || 500;
    
    this.debounceTimer = null;
    this.suggestionsContainer = null;
    this.lastRequest = null;
  }

  /**
   * 🎯 SETUP - Initialiser l'autocomplete
   */
  setup() {
    const adresseInput = document.getElementById(`${this.modalId}-${this.adresseFieldId}`);
    if (!adresseInput) {
      console.warn('⚠️ AddressAutocomplete: adresse input not found');
      return;
    }

    // Créer container suggestions
    this.createSuggestionsContainer(adresseInput);

    // Listener avec debounce
    adresseInput.addEventListener('input', (e) => this.handleAddressInput(e));
    adresseInput.addEventListener('focus', (e) => this.handleAddressInput(e));
    
    // Fermer quand click ailleurs
    document.addEventListener('click', (e) => {
      if (e.target !== adresseInput && !this.suggestionsContainer?.contains(e.target)) {
        this.hideSuggestions();
      }
    });

    console.log('✅ AddressAutocomplete setup complete');
  }

  createSuggestionsContainer(adresseInput) {
  this.suggestionsContainer = document.createElement('div');
  this.suggestionsContainer.className = 'address-suggestions-container';
  // ❌ ENLEVER le style.cssText inline !
  
  const parentContainer = adresseInput.closest('.modern-field-container');
  if (parentContainer) {
    parentContainer.appendChild(this.suggestionsContainer);
    console.log('✅ Suggestions container appended to:', parentContainer);
  } else {
    console.warn('⚠️ Parent container not found');
  }
}

  /**
   * 📥 HANDLE ADDRESS INPUT
   */
  async handleAddressInput(e) {
    const adresse = e.target.value.trim();
    const ville = document.getElementById(`${this.modalId}-${this.villeFieldId}`)?.value.trim();

    // Reset si vide
    if (!adresse || adresse.length < 2) {
      this.hideSuggestions();
      return;
    }

    // Debounce
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      await this.fetchSuggestions(adresse, ville);
    }, this.debounceDelay);
  }

  /**
   * 🌐 FETCH SUGGESTIONS - Appeler Nominatim
   */
  async fetchSuggestions(adresse, ville) {
    try {
      console.log(`🔍 Fetching suggestions for: ${adresse}${ville ? ', ' + ville : ''}`);

      const params = new URLSearchParams({
        street: adresse,
        ...(ville && { city: ville }),
        country: 'France',
        format: 'json',
        limit: 5,
        countrycodes: 'fr',
        addressdetails: 1
      });

      const url = `https://nominatim.openstreetmap.org/search?${params}`;
      this.lastRequest = url;

      // Rate limit respecté par GeocodingService.waitRateLimit()
      await window.GeocodingService?.waitRateLimit?.();

      const response = await fetch(url, {
        headers: { 'User-Agent': 'BarzikApp/1.0 (contact@barzik.fr)' }
      });

      if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);

      const results = await response.json();
      
      if (results.length === 0) {
        this.showNoResults();
        return;
      }

      this.displaySuggestions(results);

    } catch (error) {
      console.error('❌ Suggestions fetch error:', error);
      this.showError();
    }
  }

  /**
 * 🎨 DISPLAY SUGGESTIONS
 */
displaySuggestions(results) {
  this.suggestionsContainer.innerHTML = '';

  results.forEach((result) => {
  const item = document.createElement('div');
  item.className = 'suggestion-item';
 
  const houseNumber = result.address?.house_number || '';
  const road = result.address?.road || '';
  const fullAddress = [houseNumber, road].filter(Boolean).join(' ');
  
  const postcode = result.address?.postcode || '';
  const city = result.address?.city || result.address?.town || result.address?.village || '';
  const displayText = [fullAddress, postcode, city].filter(Boolean).join(', ');

    const county = result.address?.county || '';
    const state = result.address?.state || '';
    const secondaryInfo = [county, state].filter(Boolean).join(' • ');

    item.innerHTML = `
      <div>${this.escapeHtml(displayText)}</div>
      ${secondaryInfo ? `<div>${secondaryInfo}</div>` : ''}
    `;

    item.addEventListener('click', () => {
      this.selectAddress(result);
    });

    this.suggestionsContainer.appendChild(item);
  });

  this.suggestionsContainer.classList.add('show');
  console.log(`📋 Affichage ${results.length} suggestions`);
}

/**
 * ✅ SELECT ADDRESS - Remplir les champs
 */
selectAddress(result) {
  console.log('✅ Address selected:', result.display_name);

  const adresseInput = document.getElementById(`${this.modalId}-${this.adresseFieldId}`);
  const villeInput = document.getElementById(`${this.modalId}-${this.villeFieldId}`);
  const codePostalInput = document.getElementById(`${this.modalId}-${this.codePostalFieldId}`);

  if (adresseInput) {
  const houseNumber = result.address?.house_number || '';
  const road = result.address?.road || '';
  const fullAddress = [houseNumber, road].filter(Boolean).join(' ');
  
  adresseInput.value = fullAddress;
  adresseInput.dispatchEvent(new Event('input', { bubbles: true }));
  adresseInput.dispatchEvent(new Event('blur', { bubbles: true }));
}

  if (villeInput) {
    let ville = result.address?.city || result.address?.town || result.address?.village || '';
    
    if (!ville && result.display_name) {
      const parts = result.display_name.split(',').map(p => p.trim());
      if (parts.length > 1) {
        ville = parts[1];
      }
    }
    
    villeInput.value = ville;
    villeInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  if (codePostalInput) {
    codePostalInput.value = result.address?.postcode || '';
    codePostalInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  if (this.onAddressSelect) {
    this.onAddressSelect({
      adresse: result.address?.road,
      ville: result.address?.city || result.address?.town,
      codePostal: result.address?.postcode,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      displayName: result.display_name,
      address: result.address
    });
  }

  this.hideSuggestions();
}

/**
 * 🚫 SHOW NO RESULTS
 */
showNoResults() {
  this.suggestionsContainer.innerHTML = `
    <div class="suggestion-no-results">
      ⚠️ Aucune adresse trouvée. Vérifiez l'orthographe.
    </div>
  `;
  this.suggestionsContainer.classList.add('show');
}

/**
 * ❌ SHOW ERROR
 */
showError() {
  this.suggestionsContainer.innerHTML = `
    <div class="suggestion-error">
      ❌ Erreur de recherche. Réessayez.
    </div>
  `;
  this.suggestionsContainer.classList.add('show');
}

/**
 * 🙈 HIDE SUGGESTIONS - VERSION UNIQUE
 */
hideSuggestions() {
  if (this.suggestionsContainer) {
    this.suggestionsContainer.classList.remove('show');
  }
}

/**
 * 🧹 DESTROY - Cleanup
 */
destroy() {
  clearTimeout(this.debounceTimer);
  this.suggestionsContainer?.remove();
  console.log('🧹 AddressAutocomplete destroyed');
}

/**
 * 🛡️ ESCAPE HTML
 */
escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
}

// Export global
if (typeof window !== 'undefined') {
  window.AddressAutocomplete = AddressAutocomplete;
}

export default AddressAutocomplete;