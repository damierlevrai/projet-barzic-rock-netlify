// Import des services essentiels
import { supabase } from "./services/supabaseClient.js";
import Auth from "./services/auth.js";
import RouteGuard from "./services/routeGuard.js";



/**
 * 📄 Mapping explicite des pages
 * Chaque clé correspond à une "pageName" utilisée dans les routes
 */
const PAGE_MAP = {
  PublicPage: () => import("./pages/public/PublicPage.js"),  
  OrgaDashboard: () => import("./pages/OrgaDashboard.js"),
  AdminDashboard: () => import("./pages/admin/AdminDashboard.js"),
   
};

/**
 * 🎯 BarzikApp - Application principale
 */
export class BarzikApp {
  constructor() {
    this.currentPage = null;
    this.isInitialized = false;
    this.routes = {       
      "/public": "PublicPage",
      "/orga": "OrgaDashboard",
      "/admin": "AdminDashboard",
    };
    
  }

  /**
   * 🚀 Initialisation
   */
  async init() {
    try {
      
      await this.testSupabase();      
      await Auth.init();      
      this.setupRouter();
      this.setupAuthListener();
      await this.loadInitialPage();
      this.hideGlobalLoader();
      this.isInitialized = true;      
    } catch (error) {      
      this.showError("Erreur d'initialisation de l'application");
    }
  }

  async testSupabase() {
    try {
      const { data, error } = await supabase.from("events").select("id").limit(1);
      if (error) throw error;      
    } catch (error) {
      
    }
  }

  setupRouter() {
    window.addEventListener("popstate", () => {
      this.handleRoute(window.location.pathname);
    });

    document.addEventListener("click", (e) => {
      const link = e.target.closest("a[href]");
      if (link && link.href.startsWith(window.location.origin)) {
        e.preventDefault();
        const path = new URL(link.href).pathname;
        this.navigateTo(path);
      }
    });
  }

  setupAuthListener() {
    Auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
            // Ne pas rediriger si déjà sur la bonne page
            const user = Auth.getCurrentUser();
            const targetPath = user?.role === 'admin' ? '/admin' 
                : user?.role === 'organizer' ? '/orga' 
                : '/public';
            if (window.location.pathname === targetPath) return;

            const modalOpen = document.querySelector('[id*="-modal"].modal-open');
            if (modalOpen) {
                console.log('Modal ouverte, ignorer redirection');
                return;
            }
            this.redirectAfterAuth();
        } else if (event === "SIGNED_OUT") {
            this.navigateTo("/auth");
        }
    });
}


  async loadInitialPage() {
    const currentPath = window.location.pathname;

    if (
      Auth.isAuthenticated() &&
      (currentPath === "/" || currentPath === "/auth" || currentPath === "/public")
    ) {
      this.redirectAfterAuth();
      return;
    }

    await this.handleRoute(currentPath);
  }

  redirectAfterAuth() {
    const userRole = Auth.getCurrentUser()?.role;    

    if (userRole === "admin") this.navigateTo("/admin");
    else if (userRole === "organizer") this.navigateTo("/orga");
    else this.navigateTo("/public");
  }

  async navigateTo(path) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    await this.handleRoute(path);
  }

  async handleRoute(path) {    
    if (path === "/") path = "/public";

    if (!RouteGuard.canAccess(path)) {
      const redirectPath = RouteGuard.getRedirectPath(path);      
      this.navigateTo(redirectPath);
      return;
    }

    const pageName = this.routes[path] || "PublicPage";
    console.log('Route:', path, 'PageName:', pageName);  // ← AJOUTER
    await this.loadPage(pageName);
}

  async loadPage(pageName) {    

    if (this.currentPage?.destroy) this.currentPage.destroy();
    await this.exitTransition();

    try {
      const loader = PAGE_MAP[pageName];
      if (!loader) throw new Error(`Page inconnue: ${pageName}`);

      const pageModule = await loader();
      const PageClass = pageModule.default;

      this.currentPage = new PageClass();
      await this.currentPage.init?.();
      await this.currentPage.render?.();

      await this.enterTransition();      
    } catch (error) {      
      if (pageName !== "PublicPage") {
        await this.loadPage("PublicPage");
      } else {
        this.showError("Impossible de charger l'application");
      }
    }
  }

  async exitTransition() {
    const app = document.getElementById("app");
    if (app) {
      app.style.opacity = "0";
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  async enterTransition() {
    const app = document.getElementById("app");
    if (app) {
      app.style.opacity = "1";
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  hideGlobalLoader() {
    const loader = document.getElementById("global-loader");
    if (loader) {
      loader.style.opacity = "0";
      setTimeout(() => (loader.style.display = "none"), 300);
    }
  }

  showError(message) {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `
        <div style="
          display:flex;justify-content:center;align-items:center;
          height:100vh;background:#1a1a1a;color:#ff6b6b;
          font-family:'Segoe UI',sans-serif;text-align:center;">
          <div>
            <h2>🎸 Erreur Barzik Rock</h2>
            <p>${message}</p>
            <button onclick="location.reload()" style="
              background:#667eea;color:white;border:none;
              padding:10px 20px;border-radius:5px;cursor:pointer;
              margin-top:20px;">
              🔄 Recharger
            </button>
          </div>
        </div>`;
    }
  }

  
}
