# Acceso por usuario

La aplicación requiere su servidor Node.js para iniciar sesión. Los nombres de
usuario se comparan sin distinguir mayúsculas y minúsculas; las contraseñas sí
distinguen mayúsculas y minúsculas.

| Usuario | Acceso |
| --- | --- |
| Admin | Marketing, Ventas y Redes Sociales de ambas empresas |
| Saul Peña | Redes Sociales |
| Gerente EHS | Consultar y editar únicamente Ventas de EHS |
| Gerente Grh | Consultar y editar únicamente Ventas de GESTIONRH |

El servidor verifica una cookie de sesión firmada, filtra las respuestas de datos
y rechaza cambios de empresa o campos ajenos a Ventas para los gerentes. Los
roles del navegador y el encabezado `X-User-Role` no conceden permisos.

Las sesiones duran 12 horas. Configura `SESSION_SECRET` como variable secreta del
servidor, con un valor aleatorio largo y compartido por todas las instancias de
producción (incluido Vercel). Sin esta variable, se genera una clave temporal al
arrancar: las sesiones locales dejan de ser válidas al reiniciar y no se comparten
entre instancias. No guardes su valor en Git.

Después de actualizar, las sesiones antiguas guardadas solo en el navegador
requieren iniciar sesión de nuevo.

Ejecuta `node --test tests/access.test.js` para verificar los permisos con un
servidor aislado y datos temporales, sin modificar los datos de la aplicación.
