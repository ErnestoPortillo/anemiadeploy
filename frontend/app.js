const API_BASE_URL = "https://anemiadeploy.onrender.com";

if (!localStorage.getItem("role")) {
  window.location.href = "login.html";
}

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function authHeaders() {
  const token = localStorage.getItem("authToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function parseOrNull(value, asNumber = false) {
  if (value === "" || value === null || value === undefined) return null;
  return asNumber ? Number(value) : value;
}

function setText(selector, value) {
  const node = $(selector);
  if (node) node.textContent = value;
}

function setPredictMessage(message, isError = false) {
  const node = $("#predict-message");
  node.textContent = message;
  node.style.color = isError ? "#ffb4ab" : "#aeb8c6";
}

$$(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".tab-btn").forEach((tab) => tab.classList.remove("active"));
    $$(".screen").forEach((screen) => screen.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.target).classList.add("active");
  });
});

$("#btn-predict").addEventListener("click", async () => {
  const payload = {
    child_age_months: parseOrNull($("#child_age_months").value, true),
    child_sex: parseOrNull($("#child_sex").value, true),
    child_weight_kg: parseOrNull($("#child_weight_kg").value, true),
    child_height_cm: parseOrNull($("#child_height_cm").value, true),
    birth_order: parseOrNull($("#birth_order").value, true),
    birth_interval_months: parseOrNull($("#birth_interval_months").value, true),
    mother_age_years: parseOrNull($("#mother_age_years").value, true),
    mother_weight_kg: parseOrNull($("#mother_weight_kg").value, true),
    mother_height_cm: parseOrNull($("#mother_height_cm").value, true),
    mother_education_level_summary: parseOrNull($("#mother_education_level_summary").value, true),
    cigarettes_last24h: parseOrNull($("#cigarettes_last24h").value, true),
    marital_status: parseOrNull($("#marital_status").value, true),
    currently_pregnant: parseOrNull($("#currently_pregnant").value, true),
  };

  setPredictMessage("Calculando riesgo...");

  let data;
  try {
    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    data = await response.json();
  } catch (error) {
    console.error("Error de conexión con el backend:", error);
    setPredictMessage("No se pudo conectar al servidor de predicción.", true);
    return;
  }

  if (data.error) {
    setPredictMessage(data.error, true);
    return;
  }

  setText("#res-score", data.score ?? "—");
  setText("#res-label", data.label ?? "—");
  setText("#res-prob", data.prob ? `${Math.round(data.prob * 100)}%` : "—");
  setPredictMessage("Resultado actualizado desde el modelo.");

  const label = $("#res-label");
  label.style.color = data.label === "Alto" ? "#ef4444" : data.label === "Moderado" ? "#f59e0b" : "#22c55e";
});

function calcularModeloLocal(patient) {
  let score = 42;

  if (!Number.isNaN(patient.edad)) {
    if (patient.edad < 24) score += 12;
    else if (patient.edad > 48) score -= 4;
    else score += 3;
  }
  if (!Number.isNaN(patient.peso)) {
    if (patient.peso < 10) score += 10;
    else if (patient.peso > 18) score -= 5;
    else score += 2;
  }
  if (!Number.isNaN(patient.talla)) {
    if (patient.talla < 75) score += 8;
    else if (patient.talla > 95) score -= 4;
    else score += 1;
  }
  if (!Number.isNaN(patient.madreEdad)) {
    if (patient.madreEdad < 20) score += 7;
    else if (patient.madreEdad > 35) score += 4;
    else score -= 2;
  }
  if (!Number.isNaN(patient.madrePeso) && patient.madrePeso < 50) score += 5;
  if (!Number.isNaN(patient.madrePeso) && patient.madrePeso > 70) score -= 2;
  if (!Number.isNaN(patient.madreTalla) && patient.madreTalla < 150) score += 5;
  if (patient.educacion === "Primaria") score += 8;
  if (patient.orden?.startsWith("Tercero")) score += 7;
  if (patient.intervalo === "Menos de 24") score += 8;
  if (patient.cigarrillos?.startsWith("Sí")) score += 6;
  if (patient.embarazada?.startsWith("Sí")) score += 4;

  score = clamp(Math.round(score), 0, 100);
  return {
    score,
    probabilidad: score,
    riesgo: score >= 65 ? "Alto" : score >= 40 ? "Moderado" : "Bajo",
  };
}

const pacientes = [
  { nombre: "Paciente 1", hcl: "HCL-0001", distrito: "SJL", edad: 15, sexo: "Femenino", peso: 9.4, talla: 72, madreEdad: 19, educacion: "Primaria", madrePeso: 48, madreTalla: 148, orden: "Primero", intervalo: "48 o más", cigarrillos: "No", estadoCivil: "Conviviente", embarazada: "No", fecha: "2025-11-30", scoreSerie: [58, 62, 68, 72] },
  { nombre: "Paciente 2", hcl: "HCL-0002", distrito: "Comas", edad: 17, sexo: "Masculino", peso: 11.1, talla: 77, madreEdad: 28, educacion: "Secundaria", madrePeso: 60, madreTalla: 160, orden: "Segundo", intervalo: "Menos de 24", cigarrillos: "Sí", estadoCivil: "Soltera", embarazada: "No", fecha: "2025-11-29", scoreSerie: [44, 47, 52, 59] },
  { nombre: "Paciente 3", hcl: "HCL-0003", distrito: "Ate", edad: 38, sexo: "Femenino", peso: 15.8, talla: 91, madreEdad: 31, educacion: "Superior", madrePeso: 66, madreTalla: 158, orden: "Segundo", intervalo: "24 a 47", cigarrillos: "No", estadoCivil: "Casada", embarazada: "No", fecha: "2025-11-28", scoreSerie: [33, 31, 35, 37] },
  { nombre: "Paciente 4", hcl: "HCL-0004", distrito: "Callao", edad: 22, sexo: "Masculino", peso: 9.8, talla: 74, madreEdad: 37, educacion: "Primaria", madrePeso: 52, madreTalla: 149, orden: "Tercero o más", intervalo: "Menos de 24", cigarrillos: "No", estadoCivil: "Conviviente", embarazada: "Sí", fecha: "2025-11-28", scoreSerie: [64, 69, 73, 78] },
  { nombre: "Paciente 5", hcl: "HCL-0005", distrito: "SJL", edad: 33, sexo: "Femenino", peso: 13.2, talla: 86, madreEdad: 24, educacion: "Secundaria", madrePeso: 55, madreTalla: 153, orden: "Tercero o más", intervalo: "24 a 47", cigarrillos: "No", estadoCivil: "Conviviente", embarazada: "No", fecha: "2025-11-27", scoreSerie: [48, 50, 53, 55] },
  { nombre: "Paciente 6", hcl: "HCL-0006", distrito: "Comas", edad: 12, sexo: "Masculino", peso: 8.6, talla: 70, madreEdad: 18, educacion: "Primaria", madrePeso: 47, madreTalla: 151, orden: "Primero", intervalo: "48 o más", cigarrillos: "No", estadoCivil: "Soltera", embarazada: "No", fecha: "2025-11-26", scoreSerie: [66, 70, 75, 80] },
  { nombre: "Paciente 7", hcl: "HCL-0007", distrito: "Ate", edad: 49, sexo: "Femenino", peso: 18.6, talla: 98, madreEdad: 29, educacion: "Superior", madrePeso: 73, madreTalla: 162, orden: "Segundo", intervalo: "48 o más", cigarrillos: "No", estadoCivil: "Casada", embarazada: "No", fecha: "2025-11-26", scoreSerie: [24, 28, 30, 29] },
].map((patient, id) => ({ ...patient, id, ...calcularModeloLocal(patient) }));

function riskClass(riesgo) {
  if (riesgo === "Alto") return "risk-high";
  if (riesgo === "Moderado") return "risk-mid";
  return "risk-low";
}

function pintarTabla() {
  const tbody = $("#tabla-pacientes tbody");
  const query = ($("#med-buscar").value || "").toLowerCase();
  const estado = $("#med-estado").value;
  tbody.innerHTML = "";

  pacientes
    .filter((patient) => patient.nombre.toLowerCase().includes(query) || patient.hcl.toLowerCase().includes(query) || patient.distrito.toLowerCase().includes(query))
    .filter((patient) => !estado || patient.riesgo === estado)
    .sort((a, b) => b.score - a.score)
    .forEach((patient) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${patient.nombre}</td>
        <td>${patient.edad}</td>
        <td>${patient.score}</td>
        <td><span class="badge ${riskClass(patient.riesgo)}">${patient.riesgo}</span></td>
        <td><button class="btn ghost btn-mini" data-i="${patient.id}">Ver</button></td>
      `;
      tbody.appendChild(row);
    });
}

function mostrarDetallePaciente(id) {
  const patient = pacientes.find((item) => item.id === Number(id)) || pacientes[0];
  setText("#det-nombre", patient.nombre);
  setText("#det-score", patient.score);
  setText("#det-prob", `${patient.probabilidad}%`);
  setText("#det-hcl", patient.hcl);
  $("#det-risk").innerHTML = `<span class="badge ${riskClass(patient.riesgo)}">${patient.riesgo}</span>`;
  setText("#det-edad-sexo", `${patient.edad} meses / ${patient.sexo}`);
  setText("#det-distrito", patient.distrito);
  setText("#det-medidas", `${patient.peso} kg, ${patient.talla} cm`);
  setText("#det-madre", `${patient.madreEdad} años, ${patient.educacion}, ${patient.madrePeso} kg, ${patient.madreTalla} cm`);
  setText("#det-reproductiva", `${patient.orden}; intervalo ${patient.intervalo}`);
  setText("#det-habitos", `Tabaco: ${patient.cigarrillos}; estado civil: ${patient.estadoCivil}; embarazada: ${patient.embarazada}`);
  pintarLinea($("#det-trend"), patient.scoreSerie, { min: 0, max: 100 });
}

$("#med-buscar").addEventListener("input", pintarTabla);
$("#med-estado").addEventListener("change", pintarTabla);
$("#tabla-pacientes tbody").addEventListener("click", (event) => {
  const id = event.target.dataset?.i;
  if (id !== undefined) mostrarDetallePaciente(id);
});

function pintarLinea(svg, serie, { min = 0, max = 100 } = {}) {
  svg.innerHTML = "";
  const { width, height } = svg.viewBox.baseVal;
  const pad = 24;
  const x = (index) => pad + index * ((width - 2 * pad) / (serie.length - 1));
  const y = (value) => height - pad - ((value - min) / (max - min)) * (height - 2 * pad);
  let path = `M ${x(0)} ${y(serie[0])}`;

  svg.insertAdjacentHTML("beforeend", `<line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" class="axis"/>`);
  svg.insertAdjacentHTML("beforeend", `<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" class="axis"/>`);
  serie.forEach((value, index) => {
    if (index > 0) path += ` L ${x(index)} ${y(value)}`;
  });
  svg.insertAdjacentHTML("beforeend", `<path d="${path}" class="stroke"/>`);
  serie.forEach((value, index) => {
    svg.insertAdjacentHTML("beforeend", `<circle cx="${x(index)}" cy="${y(value)}" r="3" class="dot"/>`);
  });
}

function pintarBarras(svg, data) {
  svg.innerHTML = "";
  const { width, height } = svg.viewBox.baseVal;
  const pad = 24;
  const max = Math.max(...data.map((item) => item.v), 1);

  if (!data.length) {
    svg.insertAdjacentHTML("beforeend", `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" class="tick">Sin datos</text>`);
    return;
  }

  const barWidth = 42;
  const gap = 24;
  data.forEach((item, index) => {
    const barHeight = (item.v / max) * (height - 2 * pad);
    const barX = pad + index * (barWidth + gap);
    const barY = height - pad - barHeight;
    svg.insertAdjacentHTML("beforeend", `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" class="bar"/>`);
    svg.insertAdjacentHTML("beforeend", `<text x="${barX + barWidth / 2}" y="${height - pad + 14}" text-anchor="middle" class="tick">${item.k}</text>`);
  });
  svg.insertAdjacentHTML("beforeend", `<line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" class="axis"/>`);
}

function pintarDonut(svg, items) {
  svg.innerHTML = "";
  const { width, height } = svg.viewBox.baseVal;
  const cx = width / 2;
  const cy = height / 2;
  const r = 60;
  const total = items.reduce((sum, item) => sum + item.v, 0) || 1;
  const colors = { Bajo: "#22c55e", Moderado: "#f59e0b", Alto: "#ef4444" };
  let angle = -Math.PI / 2;

  items.forEach((item) => {
    const fraction = item.v / total;
    const nextAngle = angle + fraction * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(nextAngle);
    const y2 = cy + r * Math.sin(nextAngle);
    const large = fraction > .5 ? 1 : 0;
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${cx} ${cy} Z`;
    svg.insertAdjacentHTML("beforeend", `<path d="${path}" fill="${colors[item.k]}" opacity="0.8"></path>`);
    angle = nextAngle;
  });

  svg.insertAdjacentHTML("beforeend", `<circle cx="${cx}" cy="${cy}" r="34" fill="#0b1220" stroke="rgba(255,255,255,.12)"/>`);
  svg.insertAdjacentHTML("beforeend", `<text x="${cx}" y="${cy}" text-anchor="middle" class="tick">${items.map((item) => `${item.k}: ${item.v}`).join(" • ")}</text>`);
}

function contarPor(lista, key) {
  return lista.reduce((acc, item) => {
    const value = typeof key === "function" ? key(item) : item[key];
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function pacientesFiltradosCoordinador() {
  const distrito = $("#f-distrito").value;
  const estado = $("#f-estado").value;
  const rango = ($("#f-edad").value || "").match(/\d+/g)?.map(Number) || [];
  const fechas = ($("#f-fecha").value || "").match(/\d{4}-\d{2}-\d{2}/g) || [];

  return pacientes
    .filter((patient) => !distrito || patient.distrito === distrito)
    .filter((patient) => !estado || patient.riesgo === estado)
    .filter((patient) => rango.length < 2 || (patient.edad >= rango[0] && patient.edad <= rango[1]))
    .filter((patient) => fechas.length < 2 || (patient.fecha >= fechas[0] && patient.fecha <= fechas[1]));
}

function pintarCoordinador() {
  const lista = pacientesFiltradosCoordinador();
  const totalForMath = lista.length || 1;
  const altos = lista.filter((patient) => patient.riesgo === "Alto").length;
  const promedio = Math.round(lista.reduce((sum, patient) => sum + patient.score, 0) / totalForMath);
  const trend = [0, 1, 2, 3].map((index) => Math.round(lista.reduce((sum, patient) => sum + patient.scoreSerie[index], 0) / totalForMath));
  const riesgos = ["Bajo", "Moderado", "Alto"].map((key) => ({ k: key, v: contarPor(lista, "riesgo")[key] || 0 }));
  const distritos = Object.entries(contarPor(lista, "distrito")).map(([key, value]) => ({ k: key, v: value }));

  setText("#coor-total", lista.length);
  setText("#coor-alto", `${altos} (${Math.round((altos * 100) / totalForMath)}%)`);
  setText("#coor-promedio", lista.length ? promedio : "—");
  pintarLinea($("#coor-trend"), trend, { min: 0, max: 100 });
  pintarDonut($("#coor-donut"), riesgos);
  pintarBarras($("#coor-bars"), distritos);
}

["f-distrito", "f-edad", "f-fecha", "f-estado"].forEach((id) => {
  const element = $(`#${id}`);
  element.addEventListener(element.tagName === "SELECT" ? "change" : "input", pintarCoordinador);
});

pintarTabla();
mostrarDetallePaciente(0);
pintarCoordinador();
