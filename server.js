const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Insumos en almacén
let insumos = [
  { id: 1, nombre: 'Fideos guiseros', cantidad: 40, unidad: 'kg', vencimiento: '2026-11-20' },
  { id: 2, nombre: 'Salsa de tomate', cantidad: 30, unidad: 'unidades', vencimiento: '2026-12-05' },
  { id: 3, nombre: 'Carne picada', cantidad: 15, unidad: 'kg', vencimiento: '2026-10-15' },
  { id: 4, nombre: 'Arroz largo fino', cantidad: 25, unidad: 'kg', vencimiento: '2027-01-10' }
];

// 2. Padrón de familias / personas que reciben viandas
let beneficiarios = [
  { id: 1, nombre: 'Familia González', barrio: 'B° San Roque', porciones: 4, metodo: 'Reparto', estado: 'Pendiente' },
  { id: 2, nombre: 'Rosa Morales', barrio: 'B° Belgrano', porciones: 2, metodo: 'Retira en sede', estado: 'Pendiente' },
  { id: 3, nombre: 'Familia Silva', barrio: 'B° San Roque', porciones: 5, metodo: 'Reparto', estado: 'Pendiente' },
  { id: 4, nombre: 'Mario Juárez', barrio: 'Centro', porciones: 3, metodo: 'Retira en sede', estado: 'Pendiente' }
];

// 3. Tablero de tareas y voluntarios
let tareas = [
  { id: 1, rol: 'Cocinero', responsable: 'Juan Herrera', estado: 'Confirmado' },
  { id: 2, rol: 'Empaque de viandas', responsable: 'Agustina Vega', estado: 'Pendiente' },
  { id: 3, rol: 'Reparto barrial', responsable: 'Carlos Gómez', estado: 'Confirmado' }
];

// --- ENDPOINTS INSUMOS ---
app.get('/api/insumos', (req, res) => res.json(insumos));

app.post('/api/insumos/descontar', (req, res) => {
  const { insumoId, cantidadUsada } = req.body;
  const item = insumos.find(i => i.id === Number(insumoId));
  if (!item) return res.status(404).json({ error: 'Insumo no encontrado' });

  item.cantidad = Math.max(0, parseFloat((item.cantidad - Number(cantidadUsada)).toFixed(2)));
  res.json({ success: true, item });
});

// Descontar automáticamente según el recetario calculado
app.post('/api/receta/descontar-automatica', (req, res) => {
  const totalViandas = beneficiarios.reduce((acc, b) => acc + b.porciones, 0);

  // Regla por vianda: 0.1 kg fideos, 0.08 kg carne, 0.2 unidad salsa
  const fideosReq = parseFloat((totalViandas * 0.1).toFixed(2));
  const carneReq = parseFloat((totalViandas * 0.08).toFixed(2));
  const salsaReq = Math.ceil(totalViandas * 0.2);

  const fideos = insumos.find(i => i.id === 1);
  const salsa = insumos.find(i => i.id === 2);
  const carne = insumos.find(i => i.id === 3);

  if (fideos) fideos.cantidad = Math.max(0, parseFloat((fideos.cantidad - fideosReq).toFixed(2)));
  if (carne) carne.cantidad = Math.max(0, parseFloat((carne.cantidad - carneReq).toFixed(2)));
  if (salsa) salsa.cantidad = Math.max(0, salsa.cantidad - salsaReq);

  res.json({ success: true, insumos });
});

// --- ENDPOINTS BENEFICIARIOS Y RECETA ---
app.get('/api/beneficiarios', (req, res) => res.json(beneficiarios));

app.post('/api/beneficiarios', (req, res) => {
  const { nombre, barrio, porciones, metodo } = req.body;
  const nuevo = {
    id: Date.now(),
    nombre,
    barrio,
    porciones: Number(porciones),
    metodo,
    estado: 'Pendiente'
  };
  beneficiarios.push(nuevo);
  res.json(nuevo);
});

app.post('/api/beneficiarios/cambiar-entrega', (req, res) => {
  const { id } = req.body;
  const item = beneficiarios.find(b => b.id === Number(id));
  if (item) {
    item.estado = item.estado === 'Entregado' ? 'Pendiente' : 'Entregado';
    return res.json(item);
  }
  res.status(404).json({ error: 'Beneficiario no encontrado' });
});

// Catálogo dinámico de platos (arranca con Guiso por defecto)
let recetas = [
  {
    id: 1,
    nombre: 'Guiso Comunitario',
    ingredientes: [
      { idInsumo: 1, insumo: 'Fideos guiseros', porcion: 0.1, unidad: 'kg' },
      { idInsumo: 3, insumo: 'Carne picada', porcion: 0.08, unidad: 'kg' },
      { idInsumo: 2, insumo: 'Salsa de tomate', porcion: 0.2, unidad: 'unidades' }
    ]
  }
];

// Obtener todas las recetas creadas
app.get('/api/recetas', (req, res) => res.json(recetas));

// Crear una nueva receta / plato
app.post('/api/recetas', (req, res) => {
  const { nombre, ingredientes } = req.body;
  const nuevaReceta = {
    id: Date.now(),
    nombre,
    ingredientes // array de { idInsumo, insumo, porcion, unidad }
  };
  recetas.push(nuevaReceta);
  res.json(nuevaReceta);
});

// Calcular requerimientos según la receta seleccionada
app.get('/api/receta/calculo', (req, res) => {
  const idReceta = Number(req.query.id);
  const receta = recetas.find(r => r.id === idReceta) || recetas[0];
  const totalViandas = beneficiarios.reduce((acc, b) => acc + b.porciones, 0);

  if (!receta) {
    return res.json({ plato: 'Sin recetas', totalViandas, requerimientos: [] });
  }

  const requerimientos = receta.ingredientes.map(ing => ({
    idInsumo: ing.idInsumo,
    insumo: ing.insumo,
    cantidad: (totalViandas * ing.porcion).toFixed(2),
    unidad: ing.unidad
  }));

  res.json({ id: receta.id, plato: receta.nombre, totalViandas, requerimientos });
});

// Descontar del inventario según la receta ejecutada
app.post('/api/receta/descontar-automatica', (req, res) => {
  const idReceta = Number(req.body.id);
  const receta = recetas.find(r => r.id === idReceta) || recetas[0];
  if (!receta) return res.status(404).json({ error: 'Receta no encontrada' });

  const totalViandas = beneficiarios.reduce((acc, b) => acc + b.porciones, 0);

  receta.ingredientes.forEach(ing => {
    const item = insumos.find(i => i.id === ing.idInsumo);
    if (item) {
      const cantidadNecesaria = totalViandas * ing.porcion;
      item.cantidad = Math.max(0, parseFloat((item.cantidad - cantidadNecesaria).toFixed(2)));
    }
  });

  res.json({ success: true, insumos });
});

// --- ENDPOINTS TAREAS ---
app.get('/api/tareas', (req, res) => res.json(tareas));

app.post('/api/tareas', (req, res) => {
  const { rol, responsable } = req.body;
  const nuevaTarea = { id: Date.now(), rol, responsable, estado: 'Pendiente' };
  tareas.push(nuevaTarea);
  res.json(nuevaTarea);
});

app.post('/api/tareas/cambiar-estado', (req, res) => {
  const { id } = req.body;
  const tarea = tareas.find(t => t.id === Number(id));
  if (tarea) {
    tarea.estado = tarea.estado === 'Confirmado' ? 'Pendiente' : 'Confirmado';
    return res.json(tarea);
  }
  res.status(404).json({ error: 'Tarea no encontrada' });
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo en: http://localhost:${PORT}`);
});