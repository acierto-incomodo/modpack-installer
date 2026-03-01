// fluent.js - Manejo de temas y efectos visuales

async function initFluentUI() {
  // 1. Aplicar Tema
  const settings = await window.api.getSettings();
  let theme = settings.theme;
  
  if (theme === 'auto') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  document.body.classList.toggle('light-theme', theme === 'light');

  // 2. Inicializar Efecto Reveal (Iluminación al pasar el mouse)
  initRevealEffect();
}

function initRevealEffect() {
  const handleMouseMove = (e) => {
    const revealElements = document.querySelectorAll('.fluent-btn, .card');
    
    revealElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      el.style.setProperty('--x', `${x}px`);
      el.style.setProperty('--y', `${y}px`);
    });
  };

  document.removeEventListener('mousemove', handleMouseMove);
  document.addEventListener('mousemove', handleMouseMove);
}

// Exponer para uso manual si es necesario
window.fluent = {
  init: initFluentUI,
  refreshReveal: initRevealEffect
};

// Iniciar automáticamente
initFluentUI();