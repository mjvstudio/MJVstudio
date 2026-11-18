/* =========================================================
   MV015 · Ampliación Mosqueda Villalba
   Este es el único archivo que hay que tocar para actualizar
   el modelo o agregar / quitar planos.
   ========================================================= */

window.MV015 = {
  codigo: 'MV015',
  titulo: 'Ampliación Mosqueda Villalba',

  /* ---------- Modelo 3D ----------
     La página prueba primero el GLB. Si no lo encuentra,
     carga el OBJ con su MTL (y las texturas que el MTL indique).
     El OBJ de SketchUp viene con Y hacia arriba; si el modelo
     aparece acostado, cambiar ejeArriba a 'z'. */
  modelo: {
    glb: 'modelo/mv015.glb',
    obj: 'modelo/Ampliación Mosqueda Villalba Web.obj',
    mtl: 'modelo/Ampliación Mosqueda Villalba Web.mtl',
    ejeArriba: 'y',
    /* Nivel de piso terminado de planta baja, en metros desde la base
       del modelo (el terreno). El corte horizontal se mide desde acá. */
    nivelPiso: 3.45,
    /* Materiales que no cuentan para centrar la cámara (el terreno). */
    excluirDelEncuadre: ['Groundcover_Sand_Smooth'],
    alturaCorteInicial: 1.2
  },

  /* ---------- Documentos ----------
     Cada carpeta lista sus PDF. Para agregar un plano:
     copiarlo a la subcarpeta y sumar una línea { titulo, archivo }. */
  carpetas: [
    {
      id: 'arquitectura',
      nombre: 'Arquitectura',
      detalle: 'Plantas, cortes, fachadas y detalles',
      archivos: [
        { titulo: 'Planos de arquitectura (A0)', archivo: 'documentos/arquitectura/A0_3_Copias_Arquitectura.pdf' },
        { titulo: 'Plano de ubicación (A4)', archivo: 'documentos/arquitectura/A4_3_Copias_Ubicación.pdf' }
      ]
    },
    {
      id: 'estructural',
      nombre: 'Estructural',
      detalle: 'Fundaciones, vigas, columnas y losas',
      archivos: [
        { titulo: 'Planos estructurales (A0)', archivo: 'documentos/estructural/A0_2_Copias_Estructura.pdf' },
        { titulo: 'Planos estructurales (A1)', archivo: 'documentos/estructural/A1_2_Copias_Estructura.pdf' },
        { titulo: 'Planos estructurales (A2)', archivo: 'documentos/estructural/A2_2_Copias_Estructura.pdf' }
      ]
    },
    {
      id: 'sanitaria',
      nombre: 'Sanitaria',
      detalle: 'Agua corriente, cloacal y pluvial',
      archivos: [
        { titulo: 'Instalaciones sanitarias (A0)', archivo: 'documentos/sanitaria/A0_2_Copias_Insts_Sanitarias.pdf' }
      ]
    },
    {
      id: 'electrica',
      nombre: 'Eléctrica',
      detalle: 'Tablero, circuitos, bocas e iluminación',
      archivos: [
        { titulo: 'Instalaciones eléctricas (A0)', archivo: 'documentos/electrica/A0_1_Copia_Insts_Eléctricas.pdf' },
        { titulo: 'Instalaciones eléctricas (A0, hoja 2)', archivo: 'documentos/electrica/A0_2_Copias_Insts_Eléctricas.pdf' }
      ]
    }
  ]
};
