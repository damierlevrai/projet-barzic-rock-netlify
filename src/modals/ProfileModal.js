/**
 * 👥 PROFILE MODAL - Gestion des comptes
 * 
 * 3 CONTEXTES:
 * 1. Admin crée un orga (email, password, infos)
 * 2. Admin édite un orga (infos seulement)
 * 3. Orga édite son propre compte (infos + password optionnel)
 */

import BaseModal, { FormIcons } from './BaseModal.js';
import IndexedDBManager from '../services/IndexedDBManager.js';
import Auth from '../services/auth.js';

export class ProfileModal extends BaseModal {
  constructor() {
    super();
    this.modalId = 'profile-modal';
    this.photoBucket = 'profile-avatars';
    this.allowPhotoUpload = false;    
    this.isAdminContext = false;
    this.isOrgaEditingOwn = false;
    this.isCreating = false;
  }

  /**
 * 🎬 OPEN - Ouvre le modal selon le contexte
 */
async open(profile = null) {
  // ✅ NOUVEAU : Protection contre double invocation
  if (this._isOpening) {
    console.warn('⚠️ Modal déjà en ouverture');
    return;
  }
  this._isOpening = true;

  try {
    this.currentData = profile || {};
    this.isEdit = !!profile;
    this.isCreating = !profile;
    this.existingPhotoId = profile?.photo_id || null;
    this.currentNewPhotoId = null;

    const user = Auth.getCurrentUser();
    this.isAdminContext = user?.role === 'admin';
    this.isOrgaEditingOwn = user?.role === 'organizer' && this.isEdit;
    
    this.isEditingOwnAccount = this.isEdit && user?.id === profile?.id;

    console.log(`👥 ProfileModal: ${this.isAdminContext ? 'Admin' : 'Organizer'} - ${this.isEdit ? 'Édition' : 'Création'}`);

    await super.open(profile);
    this.applyRoleColorToHeader();

    // ✅ Listener formatage téléphone
    const telInput = document.querySelector('input[id="telephone"]');
    if (telInput) {
      telInput.addEventListener('input', (e) => {
        e.target.value = this.formatPhoneNumber(e.target.value);
      });
    }

    
    // ✅ NOUVEAU - Event listeners pour reset password
    if (this.isAdminContext && this.isEdit && !this.isEditingOwnAccount) {
      setTimeout(() => {
        document.getElementById('send-reset-email')?.addEventListener('click', () => {
          this.sendResetEmail(profile.email);
        });
        
        document.getElementById('generate-temp-password')?.addEventListener('click', () => {
          this.generateTempPassword(profile.id, profile.email);
        });
      }, 100);
    }
  } catch (error) {
    console.error('❌ Erreur open ProfileModal:', error);
    this._isOpening = false;
    throw error;
  } finally {
    this._isOpening = false;
  }
}

  /**
   * ⚙️ GET FORM FIELDS CONFIG
   */
  getFormFieldsConfig() {
    const data = this.currentData || {};

    const fields = [
  {
    id: 'displayName',
    validation: 'required',
    value: data.displayName || '',
    placeholder: 'Jean Dupont (ou pseudo)'
  },

      {
        id: 'email',
        type: 'email',
        validation: 'email',
        value: data.email || '',
        placeholder: 'jean@example.com',
        disabled: this.isEdit
      },

      {
        id: 'telephone',
        type: 'tel',
        validation: 'phone',
        value: data.telephone || '',
        placeholder: '0612345678'
      },
      
      
    ];   

    // ADMIN EN CRÉATION: ajouter password et role
    if (this.isAdminContext && this.isCreating) {
  fields.push({
    id: 'password',
    type: 'password',
    validation: 'required',
    value: '',
    placeholder: 'Mot de passe temporaire'
  });

  fields.push({
    id: 'role',
    type: 'select',
    name: 'role',
    validation: 'required',
    value: data.role || 'organizer',
    placeholder: 'Rôle',
    options: ['organizer', 'public']
  });
}

// ✅ NOUVEAU - ADMIN EN ÉDITION: réinitialisation password
if (this.isAdminContext && this.isEdit && !this.isEditingOwnAccount) {
  fields.push({
    id: 'password-reset-section',
    type: 'custom',
    renderer: () => `
      <div class="modern-field-container" style="border-top: 1px solid rgba(102, 126, 234, 0.2); padding-top: 20px; margin-top: 20px;">
        <label class="modern-label">🔐 Réinitialiser mot de passe</label>
        <p style="color: rgba(255, 255, 255, 0.6); font-size: 13px; margin: 8px 0 16px;">
          Utilisez ces options uniquement en support exceptionnel
        </p>
        <div style="display: flex; gap: 10px; flex-direction: column;">
          <button type="button" class="btn-toolbar btn-info btn-block" id="send-reset-email" style="padding: 12px;">
            📧 Envoyer email de réinitialisation
          </button>
          <button type="button" class="btn-toolbar btn-warning btn-block" id="generate-temp-password" style="padding: 12px;">
            🔑 Générer mot de passe temporaire
          </button>
        </div>
      </div>
    `
  });
}
if (this.isEditingOwnAccount) {
  fields.push({
    id: 'change-password',
    type: 'custom',
    renderer: () => this.createPasswordChangeSection()
  });
}
return fields;

} 

  /**
   * ✅ GET VALIDATION CONFIG
   */
  getValidationConfig() {
    const config = [
      { id: 'displayName', validation: 'required', label: 'Le nom/pseudo' },
      { id: 'email', validation: 'email', label: 'L\'email' },
      { id: 'telephone', validation: 'phone', label: 'Le téléphone' }
    ];

    // ADMIN EN CRÉATION: valider password
    if (this.isAdminContext && this.isCreating) {
      config.push(
        { id: 'password', validation: 'required', label: 'Le mot de passe' },
        { id: 'role', validation: 'required', label: 'Le rôle' }
      );
    }

    return config;
  }

  validateForm() {
  const config = this.getValidationConfig()
    .filter(c => {
      if (c.id === 'email' && this.isEdit) return false;
      return true;
    });

  console.log('🔍 ProfileModal.validateForm config:', config.map(c => c.id));

  let isValid = true;
  config.forEach(fieldConfig => {
    const result = this.validateField(fieldConfig);
    console.log(`  → field "${fieldConfig.id}" (${fieldConfig.validation}): ${result ? '✅' : '❌'}`);
    if (!result) isValid = false;
  });

  console.log('🔍 validateForm résultat:', isValid);
  return isValid;
}
  applyRoleColorToHeader() {
    const headerEl = this.modalElement?.querySelector('.banner-photo-container');
    if (!headerEl) return;
    
    // Déterminer le rôle : du profile en édition OU du user connecté en création
    const role = this.currentData?.role || Auth.getCurrentUser()?.role;
    
    const roleColors = {
        'admin': '#667eea',      // Purple
        'organizer': '#10b981',  // Green
        'public': '#f59e0b'      // Amber
    };
    
    const bgColor = roleColors[role] || '#6b7280';
    
    // Appliquer la couleur au header
    headerEl.style.background = `linear-gradient(135deg, ${bgColor} 0%, ${bgColor}dd 100%)`;
    headerEl.style.padding = '20px 0';
    
    console.log(`🎨 Header coloré pour rôle: ${role} (${bgColor})`);
}

  formatPhoneNumber(phone) {
  if (!phone) return '';
  // Garder que les chiffres
  const cleaned = phone.replace(/\D/g, '');
  // Formatter en XX XX XX XX XX
  return cleaned.replace(/(\d{2})/g, '$1 ').trim();
}

  /**
   * 📊 GETTERS
   */
  getStoreName() { 
    return 'profiles'; 
  }

  getTitle() {
  if (this.isAdminContext && this.isCreating) {
    const roleLabel = {
      'organizer': 'Créer un compte',
      'public': 'Créer un compte public'
    };
    return roleLabel[this.currentData.role || 'organizer'] || 'Créer un compte';
  } else if (this.isAdminContext && this.isEdit) {
    return this.currentData.displayName || 'Compte';
  } else {
    return 'Mon compte';
  }
}

  getCacheTabName() { 
    return this.isAdminContext ? 'accounts' : 'profile'; 
  }

  getSuccessMessage(isEdit) {
    if (this.isAdminContext) {
      return isEdit ? 'Compte modifié' : 'Compte créé';
    } else {
      return 'Votre compte a été mis à jour';
    }
  }

  /**
   * 🎨 CREATE PASSWORD CHANGE SECTION - Formulaire changement password pour orga
   */
  createPasswordChangeSection() {
    return `
      <div class="modern-field-container" data-field="password-section">
        <div style="border-top: 1px solid rgba(102, 126, 234, 0.2); padding-top: 20px; margin-top: 20px;">
          <h4 style="color: #667eea; font-size: 14px; margin: 0 0 15px; text-transform: uppercase; letter-spacing: 1px;">
            Changer mon mot de passe (optionnel)
          </h4>
          
          ${this.createFormField({
  id: 'current_password',
  type: 'password',
  value: '',
  placeholder: 'Mot de passe actuel',
  validation: 'optional',
  autocomplete: 'new-password'
})}

${this.createFormField({
  id: 'new_password',
  type: 'password',
  value: '',
  placeholder: 'Nouveau mot de passe',
  validation: 'optional',
  autocomplete: 'new-password'
})}

${this.createFormField({
  id: 'confirm_password',
  type: 'password',
  value: '',
  placeholder: 'Confirmer le nouveau mot de passe',
  validation: 'optional',
  autocomplete: 'new-password'
})}
        </div>
      </div>
    `;
  }

  /**
   * 📝 PREPARE DATA BEFORE SAVE
   */
  prepareDataBeforeSave(data) {
    const prepared = {
  displayName: data.displayName.trim(),
  email: this.isEdit ? (this.currentData?.email || '') : data.email.trim(),
  telephone: data.telephone?.trim() || null
};

    // ADMIN EN CRÉATION: ajouter role
    if (this.isAdminContext && this.isCreating) {
      prepared.role = data.role || 'organizer';
      prepared.password = data.password; // Pour la Edge Function
    }

    // ORGA: gestion du changement de password
    if (this.isEditingOwnAccount) {
  const currentPass = document.getElementById(`${this.modalId}-current_password`)?.value?.trim() || '';
  const newPass = document.getElementById(`${this.modalId}-new_password`)?.value?.trim() || '';
  const confirmPass = document.getElementById(`${this.modalId}-confirm_password`)?.value?.trim() || '';

  console.log('🔑 Password fields (par ID):', { currentPass: !!currentPass, newPass: !!newPass, confirmPass: !!confirmPass });

  if (currentPass || newPass || confirmPass) {
    if (!currentPass || !newPass || !confirmPass) {
      throw new Error('Tous les champs de mot de passe sont obligatoires');
    }
    if (newPass !== confirmPass) {
      throw new Error('Les mots de passe ne correspondent pas');
    }
    if (newPass.length < 8) {
      throw new Error('Le mot de passe doit avoir au moins 8 caractères');
    }
    prepared.changePassword = {
      currentPassword: currentPass,
      newPassword: newPass
    };
  }
}

    return prepared;
  }

  /**
   * 💾 HANDLE SUBMIT - Override pour gérer les cas spéciaux
   */
  async handleSubmit(e) {
  e.preventDefault();

  // 🔄 Formater le téléphone avant validation
  const telInput = document.querySelector('input[id="telephone"]');
  if (telInput) {
    telInput.value = this.formatPhoneNumber(telInput.value);
  }

  if (this.isProcessing) return;

  if (!this.validateForm()) {
    this.showNotification('Veuillez corriger les erreurs', 'error');
    return;
  }

  this.isProcessing = true;
  const saveBtn = document.getElementById(`${this.modalId}-save`);
  const originalIcon = saveBtn?.innerHTML;

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span class="fab-icon">⏳</span>`;
    }

    const formData = new FormData(e.target);
    const rawData = Object.fromEntries(formData.entries());
    const prepared = this.prepareDataBeforeSave(rawData);

    // CAS 1: ADMIN CRÉE UN ORGA
    if (this.isAdminContext && this.isCreating) {
      await this.createUserAccount(prepared);
    }
    // CAS 2: ADMIN ÉDITE UN ORGA
    else if (this.isAdminContext && this.isEdit) {
      await this.editAdminTarget(prepared);
    }
    // CAS 3: ORGA ÉDITE SON COMPTE
    else if (this.isEditingOwnAccount) {
      await this.editOwnAccount(prepared);
    }

    this.showNotification(this.getSuccessMessage(this.isEdit), 'success');

    // ✅ INVALIDER LE CACHE IMMÉDIATEMENT (SYNC)
    if (window.TabCacheManager) {
      window.TabCacheManager.invalidate('accounts');
    }

    // ✅ Attendre un tick avant fermer
    await new Promise(resolve => requestAnimationFrame(resolve));

    this.close();

    await new Promise(resolve => requestAnimationFrame(resolve));

    // NOUVEAU : Différencier création vs édition
    if (this.isCreating) {
      // CRÉATION : rafraîchir l'onglet (la card n'existe pas encore)
      console.log('🆕 Création - rafraîchir l\'onglet');
      
      if (window.AdminDashboardInstance?.activeTabInstance?.refreshView) {
        window.AdminDashboardInstance.activeTabInstance.refreshView();
      }
    } else {
      // ÉDITION : juste dispatcher un event pour mettre à jour la card
      console.log('✏️ Édition - dispatcher event');
      window.dispatchEvent(new CustomEvent('profileUpdated', {
        detail: { profileId: this.currentData.id }
      }));
    }

    // TRIGGER SYNC (sans attendre)
    if (window.AdminDashboardInstance?.triggerSync) {
      window.AdminDashboardInstance.triggerSync().catch(err => 
        console.error('Sync error:', err)
      );
    }

  } catch (error) {
    console.error('❌ Erreur sauvegarde:', error);
    this.showNotification(`Erreur: ${error.message}`, 'error');
  } finally {
    this.isProcessing = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalIcon;
    }
  }
}

  /**
 * ➕ CREATE USER ACCOUNT - Admin crée un compte (orga ou public)
 */
async createUserAccount(data) {
  try {
    // DEBUG détaillé
    const bodyToSend = {
  email: data.email,
  password: data.password,
  displayName: data.displayName,  // ← NOUVEAU
  telephone: data.telephone,
  role: data.role
};
    
    console.log('[AUTH] === CREATE USER ACCOUNT ===');
    console.log('[AUTH] Body complet:', bodyToSend);
    console.log('[AUTH] Email:', bodyToSend.email, '| Type:', typeof bodyToSend.email);
    console.log('[AUTH] Password:', bodyToSend.password ? '***' : 'VIDE', '| Length:', bodyToSend.password?.length);
    console.log('[AUTH] Prenom:', bodyToSend.prenom, '| Length:', bodyToSend.prenom?.length);
    console.log('[AUTH] Nom:', bodyToSend.nom, '| Length:', bodyToSend.nom?.length);
    console.log('[AUTH] Telephone:', bodyToSend.telephone, '| Length:', bodyToSend.telephone?.length);
    console.log('[AUTH] Role:', bodyToSend.role, '| Type:', typeof bodyToSend.role);
    
    // Chercher les champs vides
    const emptyFields = Object.entries(bodyToSend)
      .filter(([key, value]) => !value || value.toString().trim() === '')
      .map(([key]) => key);
    
    if (emptyFields.length > 0) {
      console.error('[AUTH] CHAMPS VIDES:', emptyFields);
      throw new Error('Champs vides: ' + emptyFields.join(', '));
    }
    
    console.log('[AUTH] Avant invoke Edge Function...');

const { data: { session } } = await window.supabaseInstance.auth.getSession();

const invokePromise = window.supabaseInstance.functions.invoke('create-user-account', {
  body: bodyToSend,
  headers: {
    'Authorization': `Bearer ${session?.access_token}`
  }
});

console.log('[AUTH] Invoke retourné, attente réponse...');

const { data: result, error } = await invokePromise;

console.log('[AUTH] Invoke terminé !');
console.log('[AUTH] Response error:', error);
console.log('[AUTH] Response data:', result);
console.log('[AUTH] Response data type:', typeof result);
console.log('[AUTH] Response data keys:', result ? Object.keys(result) : 'null');

    if (error) {
      console.error('[AUTH] Edge Function error:', error);
      throw new Error(error.message || 'Erreur creation compte');
    }

    if (!result?.success) {
      console.error('[AUTH] Resultat non success:', result);
      throw new Error(result?.error || 'Compte non cree');
    }

    console.log('[AUTH] Compte cree avec succes:', result.user_id);

    // Charger le profil en IndexedDB pour l'admin
    const profile = {
  id: result.user_id,
  email: result.email,
  displayName: data.displayName,  
  telephone: data.telephone,
  role: data.role,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

    await IndexedDBManager.put('profiles', profile);
    
  } catch (error) {
    console.error('[AUTH] Erreur complete:', error);
    throw error;
  }
}
  /**
   * ✏️ EDIT ADMIN TARGET - Admin édite un orga
   */
  async editAdminTarget(data) {
  const prepared = {
    id: this.currentData.id,
    email: data.email,
    displayName: data.displayName,  // ✅ CHANGE: prenom → displayName
    telephone: data.telephone,
    role: this.currentData.role,
    is_active: this.currentData.is_active,
    created_at: this.currentData.created_at,
    updated_at: new Date().toISOString()
  };

  await IndexedDBManager.put('profiles', prepared);

  if (window.supabaseInstance) {
    await window.supabaseInstance
      .from('profiles')
      .update(prepared)
      .eq('id', this.currentData.id);
  }
}

  /**
   * 👤 EDIT ORGA OWN ACCOUNT - Orga édite son compte
   */
  async editOwnAccount(data) {
  const userId = Auth.getCurrentUser().id;

  const prepared = {
    id: userId,
    email: data.email,
    displayName: data.displayName,  // ✅ CHANGE: prenom → displayName
    telephone: data.telephone,
    role: this.currentData.role,
    is_active: this.currentData.is_active,
    created_at: this.currentData.created_at,
    updated_at: new Date().toISOString()
  };

  await IndexedDBManager.put('profiles', prepared);

  if (window.supabaseInstance) {
    await window.supabaseInstance
      .from('profiles')
      .update(prepared)
      .eq('id', userId);
  }

  if (data.changePassword) {
    try {
      await window.supabaseInstance.auth.updateUser({
        password: data.changePassword.newPassword
      });
      console.log('✅ Mot de passe changé');
    } catch (error) {
      throw new Error('Erreur changement password: ' + error.message);
    }
  }
}

    /**
   * 📧 SEND RESET EMAIL - Envoyer email de réinitialisation
   */
  async sendResetEmail(email) {
    if (!confirm(`📧 Envoyer un email de réinitialisation à ${email} ?\n\nL'utilisateur recevra un lien pour créer un nouveau mot de passe.`)) {
      return;
    }
    
    try {
      const { error } = await window.supabaseInstance.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) throw error;
      
      this.showNotification(`✅ Email envoyé à ${email}`, 'success');
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      this.showNotification(`Erreur: ${error.message}`, 'error');
    }
  }

  /**
   * 🔑 GENERATE TEMP PASSWORD - Générer mot de passe temporaire
   */
  async generateTempPassword(userId, userEmail) {
    if (!confirm(`⚠️ GÉNÉRATION MOT DE PASSE TEMPORAIRE\n\nPour: ${userEmail}\n\nUtilisez cette option uniquement en support exceptionnel.\n\nContinuer ?`)) {
      return;
    }
    
    try {
      // Générer password sécurisé
      const tempPass = 'Temp' + Math.random().toString(36).slice(-8).toUpperCase() + Math.floor(Math.random() * 100) + '!';
      
      const { error } = await window.supabaseInstance.auth.admin.updateUserById(userId, {
        password: tempPass
      });
      
      if (error) throw error;
      
      // Afficher le password (une seule fois)
      const copyToClipboard = navigator.clipboard?.writeText(tempPass);
      
      alert(
        `✅ Mot de passe temporaire généré\n\n` +
        `🔑 ${tempPass}\n\n` +
        `${copyToClipboard ? '📋 Copié dans le presse-papier\n\n' : ''}` +
        `⚠️ IMPORTANT:\n` +
        `- Transmettez ce password de manière sécurisée\n` +
        `- Demandez à l'utilisateur de le changer immédiatement\n` +
        `- Ce password ne sera plus affiché`
      );
      
      this.showNotification('✅ Password temporaire généré', 'success');
      
    } catch (error) {
      console.error('❌ Erreur génération password:', error);
      this.showNotification(`Erreur: ${error.message}`, 'error');
    }
  }
}

// Export singleton
const profileModal = new ProfileModal();
window.ProfileModal = profileModal;

export default profileModal;