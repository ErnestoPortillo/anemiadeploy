const API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || "https://anemiadeploy.onrender.com";

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const LIMA_DISTRICTS = window.APP_CONFIG?.LIMA_DISTRICTS || [];

const centrosMedicos = [
  { id: "seed-san-gabriel", nombre: "Centro de Salud San Gabriel", distrito: "San Juan de Lurigancho" },
  { id: "seed-collique", nombre: "Puesto de Salud Collique", distrito: "Comas" },
  { id: "seed-ate", nombre: "Centro Materno Infantil Ate", distrito: "Ate" },
];

function showMessage(message, isError = false) {
  const node = $("#auth-message");
  node.textContent = message;
  node.style.color = isError ? "#ffb4ab" : "#aeb8c6";
}

function renderCentros() {
  const select = $("#enf-centro");
  select.innerHTML = '<option value="">Seleccione</option>';
  centrosMedicos.forEach((centro) => {
    const option = document.createElement("option");
    option.value = String(centro.id);
    option.textContent = `${centro.nombre} — ${centro.distrito}`;
    select.appendChild(option);
  });
}

function renderDistrictSelect() {
  const select = $("#centro-distrito");
  select.innerHTML = '<option value="">Seleccione</option>';
  LIMA_DISTRICTS.forEach((distrito) => {
    const option = document.createElement("option");
    option.value = distrito;
    option.textContent = distrito;
    select.appendChild(option);
  });
}

function upsertCentro(centro) {
  const normalized = {
    id: String(centro.id || centro.nombre),
    nombre: centro.nombre,
    distrito: centro.distrito,
  };
  const index = centrosMedicos.findIndex((item) => String(item.id) === normalized.id || item.nombre === normalized.nombre);

  if (index >= 0) {
    centrosMedicos[index] = normalized;
    return;
  }

  centrosMedicos.push(normalized);
}

async function getJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || data.message || "El servidor no pudo completar la solicitud.");
  }

  return data;
}

async function requestJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || "El servidor no pudo completar la solicitud.");
  }
  return data;
}

function saveSession(data) {
  localStorage.setItem("role", data.role || "nurse");
  if (data.token) localStorage.setItem("authToken", data.token);
  if (data.userId) localStorage.setItem("userId", data.userId);
  window.location.href = "index.html";
}

async function login() {
  const payload = {
    username: $("#login-user").value.trim(),
    password: $("#login-pass").value,
  };

  if (!payload.username || !payload.password) {
    showMessage("Ingresa usuario y contraseña.", true);
    return;
  }

  showMessage("Validando credenciales...");
  const data = await requestJson("/login", payload);

  if (data.status === "ok") {
    saveSession(data);
    return;
  }

  showMessage(data.message || "Usuario o contraseña incorrectos.", true);
}

async function registrarCentro() {
  const payload = {
    nombre: $("#centro-nombre").value.trim(),
    distrito: $("#centro-distrito").value,
  };

  if (!payload.nombre || !payload.distrito) {
    showMessage("Completa el nombre del centro médico y su distrito.", true);
    return;
  }

  showMessage("Registrando centro médico...");

  try {
    const data = await requestJson("/medical-centers", payload);
    upsertCentro({ id: data.id, nombre: data.nombre || payload.nombre, distrito: data.distrito || payload.distrito });
    renderCentros();
    $("#centro-nombre").value = "";
    $("#centro-distrito").value = "";
    showMessage(`Centro médico registrado: ${payload.nombre}.`);
  } catch (error) {
    showMessage(error.message || "No se pudo registrar el centro médico.", true);
  }
}

async function registrarEnfermera() {
  const centro = centrosMedicos.find((item) => String(item.id) === $("#enf-centro").value);
  const payload = {
    nombre: $("#enf-nombre").value.trim(),
    centro_id: centro?.id || "",
    correo: $("#enf-correo").value.trim(),
    password: $("#enf-pass").value,
  };

  if (!payload.nombre || !payload.centro_id || !payload.correo || !payload.password) {
    showMessage("Completa enfermera, centro médico, correo y contraseña temporal.", true);
    return;
  }

  showMessage("Registrando enfermera...");

  try {
    await requestJson("/nurses", payload);
    showMessage(`Enfermera registrada y asociada a ${centro.nombre}.`);
  } catch (error) {
    showMessage("El backend todavía no tiene /nurses; deja listo ese endpoint para guardar la cuenta en BD.", true);
  }
}

async function cargarCentrosRegistrados() {
  try {
    const data = await getJson("/medical-centers");
    if (Array.isArray(data)) {
      data.forEach(upsertCentro);
      renderCentros();
    }
  } catch (error) {}
}

$$(".auth-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".auth-tab").forEach((tab) => tab.classList.remove("active"));
    $$(".auth-panel").forEach((panel) => panel.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.auth).classList.add("active");
  });
});

$$(".auth-submit").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      if (btn.dataset.action === "login") await login();
      if (btn.dataset.action === "centro") await registrarCentro();
      if (btn.dataset.action === "enfermera") await registrarEnfermera();
    } catch (error) {
      showMessage(error.message || "No se pudo conectar con el backend.", true);
    }
  });
});

renderDistrictSelect();
renderCentros();
cargarCentrosRegistrados();
