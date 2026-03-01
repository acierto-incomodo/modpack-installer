let strings = null;

// Escuchar eventos de bloqueo desde el proceso principal
window.api.onLockUi(() => document.body.classList.add("app-disabled"));
window.api.onUnlockUi(() => document.body.classList.remove("app-disabled"));

function goSettings() { window.location.href = "settings.html"; }

async function load() {
  if (!strings) {
    strings = await window.api.getStrings();
    const btnCompat = document.getElementById("btnCompat");
    if (btnCompat) btnCompat.textContent = strings.compatibilityExtras;
    const btnUpdates = document.getElementById("btnUpdates");
    if (btnUpdates) btnUpdates.textContent = strings.checkForUpdates;
    const btnSettings = document.getElementById("btnSettings");
    if (btnSettings) btnSettings.textContent = strings.settings;
    const madeBy = document.getElementById("madeBy");
    if (madeBy) madeBy.textContent = strings.madeBy;
  }

  const list = await window.api.getInstances();
  const container = document.getElementById("cards");
  container.innerHTML = "";

  list.forEach(pack => {
    const div = document.createElement("div");
    div.className = "card";
    
    let buttons = "";
    if (pack.status === "not-installed") {
      buttons = `<button class="fluent-btn primary" onclick="install('${pack.name}')">${strings.install}</button>`;
    } else if (pack.status === "update") {
      buttons = `<button class="fluent-btn primary" onclick="install('${pack.name}')">${strings.update}</button>`;
    } else {
      buttons = `
        <button class="fluent-btn" onclick="install('${pack.name}')">${strings.reinstall}</button>
        <button class="fluent-btn danger" onclick="removePack('${pack.name}')">${strings.delete}</button>
        <button class="fluent-btn" onclick="openFolder('${pack.name}')">${strings.location}</button>
        <button class="fluent-btn primary" onclick="launch()">${strings.launchMinecraft}</button>
        <button class="fluent-btn" onclick="launchStorm()">${strings.launchStormLauncher}</button>
      `;
    }

    let logoHtml = "";
    if (pack.logo) {
      logoHtml = `<img src="../assets/gameIcons/${pack.logo}" class="card-logo" alt="${pack.name}">`;
    }

    div.innerHTML = `
      ${logoHtml}
      <h3>${pack.name}</h3>
      <p>${strings.status} ${pack.status}</p>
      <div class="card-actions">
        ${buttons}
      </div>
    `;

    container.appendChild(div);
  });
  
  // Refrescar efecto reveal para los nuevos elementos
  if(window.fluent) window.fluent.refreshReveal();
}

function install(name){ window.api.install(name).then(load); }
function removePack(name){ window.api.delete(name).then(load); }
function openFolder(name){ window.api.openFolder(name); }
function launch(){ window.api.launch(); }
function launchStorm(){ window.api.launchStorm(); }
function launchCompatibility(){ window.api.launchCompatibility(); }

load();