class RoleManager {
  static ROLES = {
    PUBLIC: 'public',
    ADMIN: 'admin',
    ORGANIZER: 'organizer',
    ADVERTISER: 'advertiser'
  };

  static PERMISSIONS = {
    EVENT_READ_ALL: 'event:read:all',
    EVENT_CREATE: 'event:create',
    EVENT_UPDATE_OWN: 'event:update:own',
    EVENT_DELETE_OWN: 'event:delete:own',
    ADMIN_PANEL: 'admin:panel',
    ROUTE_PUBLIC: 'route:public',
    ROUTE_ADMIN: 'route:admin',
    ROUTE_ORGANIZER: 'route:organizer',
    ROUTE_ADVERTISER: 'route:advertiser'
  };

  static ROLE_PERMISSIONS = {
    [this.ROLES.PUBLIC]: [
      this.PERMISSIONS.EVENT_READ_ALL,
      this.PERMISSIONS.ROUTE_PUBLIC
    ],
    [this.ROLES.ADMIN]: Object.values(this.PERMISSIONS),
    [this.ROLES.ORGANIZER]: [
      this.PERMISSIONS.EVENT_READ_ALL,
      this.PERMISSIONS.EVENT_CREATE,
      this.PERMISSIONS.EVENT_UPDATE_OWN,
      this.PERMISSIONS.EVENT_DELETE_OWN,
      this.PERMISSIONS.ROUTE_ORGANIZER,
      this.PERMISSIONS.ROUTE_PUBLIC
    ],
    [this.ROLES.ADVERTISER]: [
      this.PERMISSIONS.EVENT_READ_ALL,
      this.PERMISSIONS.ROUTE_ADVERTISER,
      this.PERMISSIONS.ROUTE_PUBLIC
    ]
  };

  static currentUser = null;
  static currentRole = this.ROLES.PUBLIC;
  static _roleChangeCallbacks = [];

  static setCurrentUser(user) {
    const oldRole = this.currentRole;

    this.currentUser = user;

    // Mappage explicite : si Supabase envoie "authenticated"
    if (user?.user_metadata?.role && this.validateRole(user.user_metadata.role)) {
      this.currentRole = user.user_metadata.role;
    } else {
      this.currentRole = this.ROLES.PUBLIC;
    }

    // Sauvegarde
    if (user) {
      localStorage.setItem('bz_current_user', JSON.stringify(user));
      localStorage.setItem('bz_current_role', this.currentRole);
    } else {
      localStorage.removeItem('bz_current_user');
      localStorage.removeItem('bz_current_role');
    }

    console.log(`🔐 Utilisateur connecté : ${this.currentRole}`, user);

    // Callbacks si rôle changé
    if (oldRole !== this.currentRole) {
      this._triggerRoleChange(oldRole, this.currentRole, user);
    }
  }

  static getCurrentUser() {
    if (!this.currentUser) {
      const savedUser = localStorage.getItem('bz_current_user');
      const savedRole = localStorage.getItem('bz_current_role');
      if (savedUser && savedRole) {
        this.currentUser = JSON.parse(savedUser);
        this.currentRole = savedRole;
      }
    }
    return this.currentUser;
  }

  static getCurrentRole() {
    this.getCurrentUser();
    return this.currentRole;
  }
// Ajoutez ces méthodes dans la classe RoleManager

static isAuthenticated() {
  return this.currentUser !== null && this.currentUser !== undefined;
}

static logout() {
  const oldRole = this.currentRole;
  
  this.currentUser = null;
  this.currentRole = this.ROLES.PUBLIC;
  
  // Nettoyer le localStorage
  localStorage.removeItem('bz_current_user');
  localStorage.removeItem('bz_current_role');
  
  console.log('🚪 Utilisateur déconnecté');
  
  // Déclencher les callbacks de changement de rôle
  this._triggerRoleChange(oldRole, this.currentRole, null);
}
  static hasPermission(permission) {
    return (this.ROLE_PERMISSIONS[this.getCurrentRole()] || []).includes(permission);
  }

  static canAccessRoute(routePath) {
    const routePermissions = {
      '/': this.PERMISSIONS.ROUTE_PUBLIC,
      '/public': this.PERMISSIONS.ROUTE_PUBLIC,
      '/admin': this.PERMISSIONS.ROUTE_ADMIN,
      '/organizer': this.PERMISSIONS.ROUTE_ORGANIZER,
      '/advertiser': this.PERMISSIONS.ROUTE_ADVERTISER,
      '/auth': this.PERMISSIONS.ROUTE_PUBLIC
    };
    const required = routePermissions[routePath];
    return required ? this.hasPermission(required) : true;
  }

  static validateRole(role) {
    return Object.values(this.ROLES).includes(role);
  }

  static _triggerRoleChange(oldRole, newRole, user) {
    this._roleChangeCallbacks.forEach(cb => {
      try { cb(oldRole, newRole, user); } catch (e) { console.error(e); }
    });
  }

  static onRoleChange(cb) {
    if (typeof cb === 'function') this._roleChangeCallbacks.push(cb);
  }
}

export default RoleManager;
