// Si no hay sesión, volver al login
if (!localStorage.getItem("role")) {
  window.location.href = "login.html";
}

//------------------------------------------------------
//  Helper function
//------------------------------------------------------
const $ = (sel) => document.querySelector(sel);

function parseOrNull(v, asNumber = false) {
  if (v === "" || v === null || v === undefined) return null;
  return asNumber ? Number(v) : v;
}

//------------------------------------------------------
//  Tabs Navigation
//------------------------------------------------------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".screen").forEach((s) =>
      s.classList.remove("active")
    );

    document.querySelector(btn.dataset.target).classList.add("active");
  });
});

//------------------------------------------------------
//  PREDICT BUTTON
//------------------------------------------------------
$("#btn-predict").addEventListener("click", async () => {

  //------------------------------------------------------
  // 1. Build payload EXACTLY as backend InputData expects
  //------------------------------------------------------
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

  console.log("➡️ Enviando payload al backend:", payload);

  //------------------------------------------------------
  // 2. Send to API
  //------------------------------------------------------
  let res;
  try {
    res = await fetch("http://localhost:8000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("❌ Error de conexión con el backend:", error);
    alert("No se pudo conectar al servidor.");
    return;
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    console.error("❌ Error procesando JSON:", err);
    alert("Error inesperado procesando respuesta del servidor.");
    return;
  }

  console.log("⬅️ Respuesta del backend:", data);

  //------------------------------------------------------
  // 3. Error handling
  //------------------------------------------------------
  if (data.error) {
    alert("⚠️ Error: " + data.error);
    return;
  }

  //------------------------------------------------------
  // 4. Mostrar resultados en interfaz
  //------------------------------------------------------
  $("#res-score").textContent = data.score ?? "—";
  $("#res-label").textContent = data.label ?? "—";
  $("#res-prob").textContent = data.prob ? Math.round(data.prob * 100) + "%" : "—";

  // colores del estado
  const box = $("#res-label");
  if (data.label === "Alto") {
    box.style.color = "#ef4444";
  } else if (data.label === "Moderado") {
    box.style.color = "#f59e0b";
  } else {
    box.style.color = "#22c55e";
  }
});
