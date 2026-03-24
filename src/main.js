/**
 * 🎸 MAIN.JS - Point d’entrée Barzik Rock
 * Initialise et lance l’application
 */

// Import de l'application principale
import { BarzikApp } from "./app.js";

// 🚀 Instance unique
const app = new BarzikApp();

// 🎬 Auto-initialisation
document.addEventListener("DOMContentLoaded", async () => {
  await app.init();
});

// 🛠️ Export global (debug console)
window.BarzikApp = app;

export default app;
