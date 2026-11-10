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
producción (incluido Vercel). Si esta variable no existe y Firebase está
configurado, se deriva una clave estable para las sesiones a partir de su
credencial privada existente, únicamente en el servidor. Esto permite validar
la sesión entre instancias y después de un arranque en frío. Sin ninguna de estas
configuraciones, el modo local usa una clave temporal y requiere iniciar sesión
de nuevo al reiniciar. No guardes valores secretos en Git.

Después de actualizar, las sesiones antiguas guardadas solo en el navegador
requieren iniciar sesión de nuevo.

Ejecuta `node --test tests/*.test.js` para verificar los permisos, las métricas y
las sesiones entre instancias con servidores aislados y datos temporales, sin
modificar los datos de la aplicación.
