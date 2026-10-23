# Punto 21: pedir la cuenta, propina por QR y pago simulado

## Flujo

1. **Cliente** (pedido recibido) → *Pedir la Cuenta*. Se crea la cuenta en Supabase (`solicitar_cuenta`). La operación es idempotente: si se toca varias veces, devuelve la misma cuenta. Los mozos reciben la push *“Nueva solicitud de cuenta”*.
2. **Cliente** → pantalla `/cuenta` → *Escanear QR de propina*. Es obligatorio escanear uno de los 5 QR. Sin propina, la cuenta no se genera y el pago queda bloqueado.
3. Se genera el detalle con los consumos reales (`pedido_items`, con el precio registrado al hacer el pedido), el descuento de juegos, la propina y el **TOTAL**. Hasta pagar, se puede escanear otro QR para cambiar la propina.
4. **Cliente** → *Pagar $X* → confirma en la hoja inferior → pago simulado (`pagar_cuenta`). El estado pasa a *pago pendiente de confirmación*. Mozo, dueño y supervisor reciben la push *“Pago pendiente de confirmación”*. **La mesa sigue ocupada.**
5. **Mozo** → *Cuentas y liberación* (`/cuentas-mozo`) → *Confirmar pago y liberar mesa* (`confirmar_pago_cuenta`). Esta es la base del Punto 22: la operación está separada del pago, es idempotente y devuelve los datos para la futura factura PDF. El PDF y el correo no están implementados.

Estados de `cuentas.estado`: `pendiente_propina` → `lista_para_pagar` → `pago_pendiente_confirmacion` → `pago_confirmado`.

## Regla de cálculo (única, en la base y en `src/app/utils/calculo-cuenta.ts`)

```
subtotal               = Σ cantidad × precio_unitario
descuento              = redondeo(subtotal × %descuento / 100, 2)
subtotal_con_descuento = subtotal − descuento
propina                = redondeo(subtotal_con_descuento × %propina / 100, 2)
total                  = subtotal_con_descuento + propina
```

Los importes que se muestran salen siempre de Supabase (`numeric(12,2)`).

## Reglas de integridad que aplica la base de datos

- Solo se aceptan los 5 QR oficiales. El servidor interpreta el código y la app nunca envía un porcentaje.
- Descuento: solo para clientes registrados (`perfil <> 'anonimo'`), no acumulable (se conserva el primero) y con la pareja juego/porcentaje correcta (bingo 10, mayor-menor 15, trivia 20).
- Una sola cuenta abierta por mesa (índice único parcial). Cada pedido pertenece a una sola cuenta.
- El cliente se identifica por el correo de su sesión de Supabase Auth, no por un id enviado desde el teléfono. Así no puede operar la cuenta de otra mesa.
- No se puede pagar dos veces, ni cambiar la propina después del pago, ni modificar ítems o importes de un pedido incluido en una cuenta pagada (hay triggers que lo impiden).
- RLS: el cliente solo ve sus cuentas; mozo, dueño y supervisor ven todas. Nadie escribe directamente en las tablas: todo pasa por las RPC.

## Aplicar la migración

Archivos, en este orden:

1. `supabase/migrations/20261019120000_punto21_cuentas.sql`
2. `supabase/migrations/20261019130000_punto21_fix_mesa_vacia.sql`: la mesa liberada queda como `vacia`, que es el valor que admite la base.
3. `supabase/migrations/20261019140000_punto21_fix_cliente_id_texto.sql`: compara `mesas.cliente_id` como texto, porque en la base real esa columna es `text`.

- **Opción A:** Supabase Dashboard → SQL Editor → pegar el archivo completo → *Run*.
- **Opción B:** `npx supabase db push` (el proyecto ya está vinculado en `supabase/.temp`).

Después de aplicarla, ejecutar las consultas de la sección *Verificaciones recomendadas* que están al final del archivo. Sirven para confirmar la clave foránea de `pedidos.cliente_id` y los estados admitidos en `pedidos.estado` y `mesas.disponibilidad`.

No hace falta redesplegar ninguna Edge Function: se reutiliza `enviar-push` sin cambios.

## Mostrar los cinco QR de propina

- En la app: **Mozo → Cuentas y liberación → Mostrar los QR de propina** (ruta `/qr-propinas`). Se ve un código por pantalla, con botones *Anterior* y *Siguiente*.
- Imágenes: `docs/qr/qr-propina-*.png` (también aparecen en el README).

## Prueba con dispositivos Android

Antes de empezar, hay que compilar e instalar la misma versión en todos los dispositivos: `npm run build && npx cap sync android`.

| Dispositivo | Perfil | Acción |
| --- | --- | --- |
| 1 | Cliente registrado | Mesa asignada y escaneada → pedido → recibido → *Pedir la Cuenta* |
| 2 | Mozo | Recibe la push → *Cuentas y liberación* → pestaña *Cuentas solicitadas* |
| 3 | Mozo (otro dispositivo) | Abre `/qr-propinas` y muestra un QR |
| 1 | Cliente | Escanea el QR de mesa (rechazado), después el QR *Malo* (0 %) y por último *Excelente* (20 %) → revisa el detalle → *Pagar* |
| 2, dueño y supervisor | — | Reciben la push del pago → pestaña *Pagos por confirmar* |
| 1 | Cliente | Cierra y reabre la app → *Ver mi cuenta* sigue en *Esperando la confirmación del mozo* |
| 2 | Mozo | *Confirmar pago y liberar mesa* → el cliente ve *Pago confirmado* → *Finalizar visita* |

Para probar el descuento, ganar un juego en el primer intento antes de pedir la cuenta, con un cliente registrado. Con un cliente anónimo no se aplica descuento.

## Pruebas automáticas

- `npm test -- --watch=false`: reglas de cálculo y validación de QR (`src/app/utils/calculo-cuenta.spec.ts`).
- La migración se probó sobre PostgreSQL en memoria (PGlite) con un esquema mínimo que imita a Supabase: 43 verificaciones de los casos 1 a 14, RLS e idempotencia. Falta validarla sobre el esquema real.
