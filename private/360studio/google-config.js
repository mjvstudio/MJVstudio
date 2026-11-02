/* =====================================================================
   GOOGLE DRIVE EN EL 360 STUDIO (tu web)

   Pegá abajo el "ID de cliente" de Google y publicá (commit + push).
   Mientras esté vacío, la opción Google Drive avisa que falta configurarla.

   CÓMO CREAR EL ID (una sola vez, gratis, unos 10 minutos):
   1. Entrá a https://console.cloud.google.com con mjvarquitectura.py@gmail.com
      → arriba "Seleccionar proyecto" → "Proyecto nuevo" → nombre: MJV 360 Studio → Crear.
   2. Menú → "APIs y servicios" → "Biblioteca" → buscá "Google Drive API" → Habilitar.
   3. "APIs y servicios" → "Pantalla de consentimiento de OAuth" (o "Google Auth Platform"):
        - Tipo de usuario: Externo · Nombre: MJV 360 Studio · tu correo de soporte y de contacto.
        - Acceso a los datos / Permisos: agregá ".../auth/drive.readonly" (Ver y descargar archivos de Drive).
        - Público / Usuarios de prueba: agregá el Gmail de cada integrante que va a usar Drive.
          (Queda en modo "Prueba": no hace falta verificación de Google; hasta 100 personas.)
   4. "APIs y servicios" → "Credenciales" → "Crear credenciales" → "ID de cliente de OAuth":
        - Tipo: Aplicación web · Nombre: 360 Studio web
        - Orígenes de JavaScript autorizados: https://www.mjvstudio.com  y  https://mjvstudio.com
          (y http://127.0.0.1:5500 si también lo usás con Live Server)
        - Crear → copiá el "ID de cliente" (termina en .apps.googleusercontent.com).
   5. Pegalo entre las comillas de abajo, guardá y publicá.

   AL USARLO: Añadir escenas → Google Drive → "Entrar con Google". Como la app está en modo
   prueba, Google muestra "Google no verificó esta app": tocá "Continuar". Solo se pide permiso
   de LECTURA: el Studio no modifica ni borra nada de tu Drive.
   ===================================================================== */
window.MJV_GOOGLE = {
    clientId: ''   // ← ej. '1234567890-abc123.apps.googleusercontent.com'
};
