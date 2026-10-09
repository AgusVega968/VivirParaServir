let listaInsumosGlobal = [];

// 1. Cargar el selector con las recetas creadas
async function cargarSelectRecetas() {
  const res = await fetch('/api/recetas');
  const recetas = await res.json();
  const selectPlato = document.getElementById('select-plato');
  if (!selectPlato) return;

  const idActual = selectPlato.value;
  selectPlato.innerHTML = '';

  recetas.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.nombre;
    selectPlato.appendChild(opt);
  });

  if (idActual) {
    selectPlato.value = idActual;
  }
}

// 2. Cargar Beneficiarios y Recetario Dinámico filtrado por FECHA
async function cargarBeneficiariosYReceta() {
  const selectPlato = document.getElementById('select-plato');
  const inputFecha = document.getElementById('fecha-jornada');

  const idPlato = selectPlato ? selectPlato.value : '';
  const fechaSeleccionada = inputFecha ? inputFecha.value : '2026-10-10';

  const [resBen, resRec] = await Promise.all([
    fetch(`/api/beneficiarios?fecha=${fechaSeleccionada}`),
    fetch(`/api/receta/calculo?id=${idPlato}&fecha=${fechaSeleccionada}`)
  ]);

  const beneficiarios = await resBen.json();
  const calculo = await resRec.json();

  // Actualizar Título, Contador y Lista de Insumos Requeridos
  const tituloPlato = document.getElementById('titulo-plato');
  if (tituloPlato) tituloPlato.textContent = `Recetario Inteligente: ${calculo.plato}`;

  document.getElementById('total-viandas-badge').textContent = calculo.totalViandas;

  const listaReceta = document.getElementById('lista-receta-requerida');
  if (calculo.requerimientos.length === 0) {
    listaReceta.innerHTML = '<li>Sin ingredientes registrados para este plato o jornada sin viandas.</li>';
  } else {
    listaReceta.innerHTML = calculo.requerimientos.map(r => `
      <li><strong>${r.cantidad} ${r.unidad}</strong> de ${r.insumo}</li>
    `).join('');
  }

  // Llenar tabla de familias y rutas de esa fecha
  const tbodyBen = document.getElementById('tabla-beneficiarios');
  tbodyBen.innerHTML = '';
  beneficiarios.forEach(b => {
    const esEntregado = b.estado === 'Entregado';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${b.fecha}</td>
      <td><strong>${b.nombre}</strong></td>
      <td>${b.barrio}</td>
      <td>${b.porciones} viandas</td>
      <td>${b.metodo === 'Reparto' ? 'Reparto Barrial' : 'Retira en Sede'}</td>
      <td>
        <span class="badge ${esEntregado ? 'badge-confirmado' : 'badge-pendiente'}" 
              onclick="alternarEntrega(${b.id})">
          ${b.estado}
        </span>
      </td>
    `;
    tbodyBen.appendChild(tr);
  });
}

// 3. Cargar Insumos en almacén y en los formularios
async function cargarInsumos() {
  const res = await fetch('/api/insumos');
  listaInsumosGlobal = await res.json();

  const tbody = document.getElementById('tabla-insumos');
  const selectDescuento = document.getElementById('select-insumo');
  const selectReceta = document.getElementById('receta-insumo-1');

  tbody.innerHTML = '';
  selectDescuento.innerHTML = '<option value="" disabled selected>Seleccionar insumo</option>';
  if (selectReceta) {
    selectReceta.innerHTML = '<option value="" disabled selected>Seleccionar insumo base</option>';
  }

  listaInsumosGlobal.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.nombre}</strong></td>
      <td>${item.cantidad} ${item.unidad}</td>
      <td>${item.vencimiento}</td>
      <td>
        <span style="color: ${item.cantidad <= 10 ? '#dc2626' : '#16a34a'}; font-weight: 600;">
          ${item.cantidad <= 10 ? 'Stock Bajo' : 'Disponible'}
        </span>
      </td>
    `;
    tbody.appendChild(tr);

    const optDesc = document.createElement('option');
    optDesc.value = item.id;
    optDesc.textContent = `${item.nombre} (${item.cantidad} ${item.unidad})`;
    selectDescuento.appendChild(optDesc);

    if (selectReceta) {
      const optRec = document.createElement('option');
      optRec.value = item.id;
      optRec.textContent = `${item.nombre} (${item.unidad})`;
      selectReceta.appendChild(optRec);
    }
  });
}

// 4. Cargar Tareas Operativas vinculadas a la FECHA de la Jornada
async function cargarTareas() {
  const inputFecha = document.getElementById('fecha-jornada');
  const fechaSeleccionada = inputFecha ? inputFecha.value : '2026-10-10';

  const res = await fetch(`/api/tareas?fecha=${fechaSeleccionada}`);
  const tareas = await res.json();

  const grid = document.getElementById('grid-tareas');
  grid.innerHTML = '';

  if (tareas.length === 0) {
    grid.innerHTML = '<p style="color: #64748b; font-size: 0.9rem;">No hay tareas asignadas para esta jornada.</p>';
    return;
  }

  tareas.forEach(tarea => {
    const card = document.createElement('div');
    card.className = 'card-tarea';
    const esConfirmado = tarea.estado === 'Confirmado';
    
    card.innerHTML = `
      <h4>${tarea.rol}</h4>
      <p>Responsable: <strong>${tarea.responsable}</strong></p>
      <small style="color: #64748b; display: block; margin-bottom: 0.5rem;">Jornada: ${tarea.fecha}</small>
      <span class="badge ${esConfirmado ? 'badge-confirmado' : 'badge-pendiente'}" 
            onclick="alternarEstado(${tarea.id})">
        ${tarea.estado}
      </span>
    `;
    grid.appendChild(card);
  });
}

// --- EVENTOS ---

// Cambio de plato en el selector
const selectPlatoElement = document.getElementById('select-plato');
if (selectPlatoElement) {
  selectPlatoElement.addEventListener('change', cargarBeneficiariosYReceta);
}

// Cambio de fecha: actualiza beneficiarios, recetas y tareas operativas
const inputFechaElement = document.getElementById('fecha-jornada');
if (inputFechaElement) {
  inputFechaElement.addEventListener('change', (e) => {
    const nuevaFecha = e.target.value;
    
    // Sincroniza los formularios de beneficiario y de tarea con la fecha elegida
    const benFecha = document.getElementById('ben-fecha');
    if (benFecha) benFecha.value = nuevaFecha;

    const tareaFecha = document.getElementById('tarea-fecha');
    if (tareaFecha) tareaFecha.value = nuevaFecha;

    cargarBeneficiariosYReceta();
    cargarTareas();
  });
}

// Crear nueva receta
const formReceta = document.getElementById('form-nueva-receta');
if (formReceta) {
  formReceta.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('receta-nombre').value;
    const idInsumo = Number(document.getElementById('receta-insumo-1').value);
    const porcion = parseFloat(document.getElementById('receta-porcion-1').value);

    const insumoObj = listaInsumosGlobal.find(i => i.id === idInsumo);

    const payload = {
      nombre,
      ingredientes: [
        {
          idInsumo: insumoObj.id,
          insumo: insumoObj.nombre,
          porcion: porcion,
          unidad: insumoObj.unidad
        }
      ]
    };

    await fetch('/api/recetas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    document.getElementById('receta-nombre').value = '';
    document.getElementById('receta-porcion-1').value = '';

    await cargarSelectRecetas();
    cargarBeneficiariosYReceta();
  });
}

// Registrar Cocina (Descontar de Stock para la fecha activa)
document.getElementById('btn-cocinar-exacto').addEventListener('click', async () => {
  const selectPlato = document.getElementById('select-plato');
  const inputFecha = document.getElementById('fecha-jornada');
  const idPlato = selectPlato ? selectPlato.value : '';
  const fecha = inputFecha ? inputFecha.value : '2026-10-10';

  if (confirm(`¿Desea registrar la cocina y descontar los insumos para la jornada del ${fecha}?`)) {
    await fetch('/api/receta/descontar-automatica', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: idPlato, fecha })
    });
    cargarInsumos();
  }
});

// Agregar Beneficiario al padrón
document.getElementById('form-beneficiario').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fecha = document.getElementById('ben-fecha').value;
  const nombre = document.getElementById('ben-nombre').value;
  const barrio = document.getElementById('ben-barrio').value;
  const porciones = document.getElementById('ben-porciones').value;
  const metodo = document.getElementById('ben-metodo').value;

  await fetch('/api/beneficiarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fecha, nombre, barrio, porciones, metodo })
  });

  document.getElementById('ben-nombre').value = '';
  document.getElementById('ben-barrio').value = '';
  document.getElementById('ben-porciones').value = '';

  cargarBeneficiariosYReceta();
});

// Alternar estado de entrega de viandas
async function alternarEntrega(id) {
  await fetch('/api/beneficiarios/cambiar-entrega', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  cargarBeneficiariosYReceta();
}

// Descuento manual de stock
document.getElementById('form-descuento').addEventListener('submit', async (e) => {
  e.preventDefault();
  const insumoId = document.getElementById('select-insumo').value;
  const cantidadUsada = document.getElementById('input-cantidad').value;

  await fetch('/api/insumos/descontar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ insumoId, cantidadUsada })
  });

  document.getElementById('input-cantidad').value = '';
  cargarInsumos();
});

// Asignar Tarea para la jornada seleccionada
document.getElementById('form-tarea').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fecha = document.getElementById('tarea-fecha').value;
  const rol = document.getElementById('select-rol').value;
  const responsable = document.getElementById('input-responsable').value;

  await fetch('/api/tareas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fecha, rol, responsable })
  });

  document.getElementById('input-responsable').value = '';
  cargarTareas();
});

// Alternar confirmación de voluntario
async function alternarEstado(id) {
  await fetch('/api/tareas/cambiar-estado', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  cargarTareas();
}

// Secuencia de inicio
async function inicializar() {
  await cargarInsumos();
  await cargarSelectRecetas();
  await cargarBeneficiariosYReceta();
  await cargarTareas();
}

inicializar();