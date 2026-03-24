/**
 * 🔐 AUTH MODAL TEMPORAIRE
 */

class AuthModal {
  constructor() {
    this.modalId = 'temp-auth-modal';
  }

  open(mode = 'login') {
    const html = `
      <div id="${this.modalId}" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
      ">
        <div style="
          background: #1a1a25;
          padding: 40px;
          border-radius: 20px;
          width: 90%;
          max-width: 400px;
          border: 1px solid rgba(102, 126, 234, 0.3);
        ">
          <h2 style="color: #667eea; margin: 0 0 30px; text-align: center;">
            ${mode === 'login' ? '🔐 Connexion' : '📝 Inscription'}
          </h2>
          
          <form id="auth-form" style="display: flex; flex-direction: column; gap: 20px;">
            <input 
              type="email" 
              id="auth-email" 
              placeholder="Email" 
              required
              style="
                padding: 15px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 10px;
                color: white;
                font-size: 16px;
              "
            >
            
            <input 
              type="password" 
              id="auth-password" 
              placeholder="Mot de passe" 
              required
              style="
                padding: 15px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 10px;
                color: white;
                font-size: 16px;
              "
            >
            
            <button type="submit" style="
              padding: 15px;
              background: linear-gradient(135deg, #667eea, #764ba2);
              border: none;
              border-radius: 10px;
              color: white;
              font-weight: 600;
              font-size: 16px;
              cursor: pointer;
            ">
              ${mode === 'login' ? 'Se connecter' : 'S\'inscrire'}
            </button>
          </form>
          
          <p style="text-align: center; margin-top: 20px; color: rgba(255,255,255,0.6); font-size: 14px;">
            ${mode === 'login' 
              ? '<a href="#" id="switch-register" style="color: #667eea;">Créer un compte</a>' 
              : '<a href="#" id="switch-login" style="color: #667eea;">Déjà un compte ?</a>'}
          </p>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    this.setupListeners(mode);
  }

  setupListeners(mode) {
    const form = document.getElementById('auth-form');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('auth-email').value;
      const password = document.getElementById('auth-password').value;
      
      try {
        if (mode === 'login') {
          const result = await window.Auth.login(email, password);
          
          if (result.success) {
            this.close();
            window.location.href = '/admin';
          } else {
            alert('❌ ' + (result.error || 'Erreur de connexion'));
          }
        } else {
          // Inscription - à implémenter si besoin
          alert('Inscription à venir');
        }
      } catch (error) {
        alert('❌ Erreur : ' + error.message);
      }
    });

    // Switch mode
    const switchBtn = document.getElementById(mode === 'login' ? 'switch-register' : 'switch-login');
    if (switchBtn) {
      switchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.close();
        this.open(mode === 'login' ? 'register' : 'login');
      });
    }
  }

  close() {
    const modal = document.getElementById(this.modalId);
    if (modal) modal.remove();
  }
}

// Export
const authModal = new AuthModal();
window.AuthModal = authModal;

export default authModal;