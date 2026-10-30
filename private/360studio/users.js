/* =====================================================================
   USUARIOS DEL 360 STUDIO — MJV Studio

   Cada integrante tiene su propio usuario y contraseña. Acá NO se guardan
   las contraseñas: solo una "huella" (hash) que no se puede revertir.

   PARA AGREGAR UN INTEGRANTE
   1) Abrí  /private/360studio/usuarios.html  (en tu compu o en la web).
   2) Escribí el usuario y la contraseña → copiá la línea que te da.
   3) Pegala dentro de la lista de abajo y publicá (commit + push).

   PARA QUITAR A ALGUIEN: borrá su línea y publicá.
   Cada ingreso se registra en Umami > Events como  studio360-login  (con el usuario).
   ===================================================================== */

window.STUDIO_USERS = [
    { user: 'martin', name: 'Martin', salt: 'b8db63dc0e986cc175132154974b0fd7', hash: '42e56e5f52cec2a9917549af4e7a363859cee96adfa8babe915e4f1e39b0b049' },
];
