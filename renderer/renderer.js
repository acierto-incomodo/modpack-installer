async function load() {
  const list = await window.api.getInstances();
  const container = document.getElementById("cards");
  container.innerHTML = "";

  list.forEach(pack => {
    const div = document.createElement("div");
    div.className = "card";

    let buttons = "";
    if (pack.status === "not-installed") {
      buttons = `<button onclick="install('${pack.name}')">Instalar</button>`;
    } else if (pack.status === "update") {
      buttons = `<button onclick="install('${pack.name}')">Actualizar</button>`;
    } else {
      buttons = `
        <button onclick="install('${pack.name}')">Reinstalar</button>
        <button onclick="removePack('${pack.name}')">Eliminar</button>
        <button onclick="openFolder('${pack.name}')">Ubicación</button>
        <button onclick="launch()">Iniciar Minecraft</button>
      `;
    }

    div.innerHTML = `
      <h3>${pack.name}</h3>
      <p>Estado: ${pack.status}</p>
      ${buttons}
    `;

    container.appendChild(div);
  });
}

function install(name){ window.api.install(name).then(load); }
function removePack(name){ window.api.delete(name).then(load); }
function openFolder(name){ window.api.openFolder(name); }
function launch(){ window.api.launch(); }

load();