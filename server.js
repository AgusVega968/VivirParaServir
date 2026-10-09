const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Inventario en almacén
let insumos = [
  { id: 1, nombre: 'Fideos guiseros', cantidad: 40, unidad: 'kg', vencimiento: '2026-11-20' },
  { id: 2, nombre: 'Salsa de tomate', cantidad: 30, unidad: 'unidades', vencimiento: '2026-12-05' },
  { id: 3, nombre: 'Carne picada', cantidad: 15, unidad: 'kg', vencimiento: '2026-10-15' },
  { id: 4, nombre: 'Arroz largo fino', cantidad: 25, unidad: 'kg', vencimiento: '2027-01-10' }
];

// 2. Catálogo dinámico de recetas
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

// 3. Padrón de beneficiarios vinculados a la fecha
let beneficiarios = [
  { id: 1, fecha: '2026-10-10', nombre: 'Familia González', barrio: 'B° San Roque', porciones: 4, metodo: 'Reparto', estado: 'Pendiente' },
  { id: 2, fecha: '2026-10-10', nombre: 'Rosa Morales', barrio: 'B° Belgrano', porciones: 2, metodo: 'Retira en sede', estado: 'Pendiente' },
  { id: 3, fecha: '2026-10-10', nombre: 'Familia Silva', barrio: 'B° San Roque', porciones: 5, metodo: 'Reparto', estado: 'Pendiente' },
  { id: 4, fecha: '2026-10-10', nombre: 'Mario Juárez', barrio: 'Centro', porciones: 3, metodo: 'Retira en sede', estado: 'Pendiente' },
  { id: 5, fecha: '2026-10-17', nombre: 'Familia Gómez', barrio: 'B° Belgrano', porciones: 6, metodo: 'Reparto', estado: 'Pendiente' }
];

// 4. Tablero de tareas vinculado a la fecha de jornada
let tareas = [
  { id: 1, fecha: '2026-10-10', rol: 'Cocinero', responsable: 'Juan Herrera', estado: 'Confirmado' },
  { id: 2, fecha: '2026-10-10', rol: 'Empaque de viandas', responsable: 'Agustina Vega', estado: 'Pendiente' },
  { id: 3, fecha: '2026-10-10', rol: 'Reparto barrial', responsable: 'Carlos Gómez', estado: 'Confirmado' },
  { id: 4, fecha: '2026-10-17', rol: 'Cocinero', responsable: 'Lucía Morales', estado: 'Pendiente' }
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

// --- ENDPOINTS RECETAS ---
app.get('/api/recetas', (req, res) => res.json(recetas));

app.post('/api/recetas', (req, res) => {
  const { nombre, ingredientes } = req.body;
  const nuevaReceta = { id: Date.now(), nombre, ingredientes };
  recetas.push(nuevaReceta);
  res.json(nuevaReceta);
});

// Cálculo según el plato y la fecha de jornada
app.get('/api/receta/calculo', (req, res) => {
  const idReceta = Number(req.query.id);
  const fechaFiltro = req.query.fecha || '2026-10-10';

  const receta = recetas.find(r => r.id === idReceta) || recetas[0];
  const beneficiariosFecha = beneficiarios.filter(b => b.fecha === fechaFiltro);
  const totalViandas = beneficiariosFecha.reduce((acc, b) => acc + b.porciones, 0);

  if (!receta) {
    return res.json({ id: null, plato: 'Sin recetas', fecha: fechaFiltro, totalViandas: 0, requerimientos: [] });
  }

  const requerimientos = receta.ingredientes.map(ing => ({
    idInsumo: ing.idInsumo,
    insumo: ing.insumo,
    cantidad: (totalViandas * ing.porcion).toFixed(2),
    unidad: ing.unidad
  }));

  res.json({ id: receta.id, plato: receta.nombre, fecha: fechaFiltro, totalViandas, requerimientos });
});

// Descontar insumos exactos para la jornada
app.post('/api/receta/descontar-automatica', (req, res) => {
  const idReceta = Number(req.body.id);
  const fechaFiltro = req.body.fecha || '2026-10-10';

  const receta = recetas.find(r => r.id === idReceta) || recetas[0];
  if (!receta) return res.status(404).json({ error: 'Receta no encontrada' });

  const beneficiariosFecha = beneficiarios.filter(b => b.fecha === fechaFiltro);
  const totalViandas = beneficiariosFecha.reduce((acc, b) => acc + b.porciones, 0);

  receta.ingredientes.forEach(ing => {
    const item = insumos.find(i => i.id === ing.idInsumo);
    if (item) {
      const cantidadNecesaria = totalViandas * ing.porcion;
      item.cantidad = Math.max(0, parseFloat((item.cantidad - cantidadNecesaria).toFixed(2)));
    }
  });

  res.json({ success: true, insumos });
});

// --- ENDPOINTS BENEFICIARIOS ---
app.get('/api/beneficiarios', (req, res) => {
  const fechaFiltro = req.query.fecha;
  if (fechaFiltro) {
    return res.json(beneficiarios.filter(b => b.fecha === fechaFiltro));
  }
  res.json(beneficiarios);
});

app.post('/api/beneficiarios', (req, res) => {
  const { fecha, nombre, barrio, porciones, metodo } = req.body;
  const nuevo = {
    id: Date.now(),
    fecha: fecha || '2026-10-10',
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

// --- ENDPOINTS TAREAS (Filtradas por fecha) ---
app.get('/api/tareas', (req, res) => {
  const fechaFiltro = req.query.fecha;
  if (fechaFiltro) {
    return res.json(tareas.filter(t => t.fecha === fechaFiltro));
  }
  res.json(tareas);
});

app.post('/api/tareas', (req, res) => {
  const { fecha, rol, responsable } = req.body;
  const nuevaTarea = {
    id: Date.now(),
    fecha: fecha || '2026-10-10',
    rol,
    responsable,
    estado: 'Pendiente'
  };
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