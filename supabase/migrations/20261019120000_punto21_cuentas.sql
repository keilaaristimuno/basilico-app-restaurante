-- =====================================================================================
--  BASÍLICO 2026 — PUNTO 21: SOLICITUD DE CUENTA, PROPINA POR QR, DETALLE Y PAGO SIMULADO
-- =====================================================================================
--  Cómo aplicarla:
--    a) Supabase Dashboard → SQL Editor → pegar este archivo completo → Run.
--    b) o bien con la CLI:  npx supabase db push   (el proyecto ya está vinculado).
--
--  La migración NO borra ni modifica datos existentes. Solo:
--    * crea las tablas nuevas cuentas, cuenta_pedidos y cuenta_items (con RLS),
--    * crea funciones RPC SECURITY DEFINER para las operaciones críticas,
--    * agrega triggers que impiden alterar ítems/importe de pedidos ya pagados,
--    * agrega la tabla cuentas a la publicación de Realtime.
--
--  Estados de la cuenta:
--    pendiente_propina            → el cliente pidió la cuenta (mozo notificado) y falta escanear el QR de propina
--    lista_para_pagar             → propina elegida por QR, detalle generado, pago habilitado
--    pago_pendiente_confirmacion  → el cliente realizó el pago simulado, espera al mozo
--    pago_confirmado              → el mozo confirmó el pago (base del Punto 22, la mesa queda libre)
--
--  Regla monetaria única (la misma está replicada en src/app/utils/calculo-cuenta.ts):
--    subtotal               = Σ cantidad × precio_unitario (precio registrado al hacer el pedido)
--    descuento              = round(subtotal × %descuento / 100, 2)
--    subtotal_con_descuento = subtotal − descuento
--    propina                = round(subtotal_con_descuento × %propina / 100, 2)
--    total                  = subtotal_con_descuento + propina
-- =====================================================================================

begin;

-- -------------------------------------------------------------------------------------
-- 1. IDENTIDAD DEL USUARIO AUTENTICADO
--    Tanto el cliente registrado como el anónimo tienen sesión en Supabase Auth cuyo
--    correo coincide con clientes.correo; los empleados con empleados.correo.
--    Se usa el correo del JWT (no editable por el cliente) en lugar de un id enviado
--    desde el dispositivo.
-- -------------------------------------------------------------------------------------
create or replace function public.fn_cliente_actual_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.clientes c
  where lower(c.correo) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by c.created_at desc
  limit 1;
$$;

create or replace function public.fn_empleado_actual_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id
  from public.empleados e
  where lower(e.correo) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by e.created_at desc
  limit 1;
$$;

create or replace function public.fn_perfil_empleado_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(e.perfil)
  from public.empleados e
  where lower(e.correo) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by e.created_at desc
  limit 1;
$$;

-- -------------------------------------------------------------------------------------
-- 2. TABLAS
-- -------------------------------------------------------------------------------------
create table if not exists public.cuentas (
  id                    uuid primary key default gen_random_uuid(),
  numero                bigint generated always as identity,
  mesa_id               uuid not null references public.mesas(id),
  cliente_id            uuid not null references public.clientes(id),
  numero_mesa           integer not null,
  estado                text not null default 'pendiente_propina',
  subtotal              numeric(12,2) not null default 0,
  descuento_porcentaje  smallint not null default 0,
  descuento_juego       text,
  descuento_importe     numeric(12,2) not null default 0,
  propina_nivel         text,
  propina_porcentaje    smallint,
  propina_importe       numeric(12,2) not null default 0,
  total                 numeric(12,2) not null default 0,
  pago_referencia       text,
  solicitada_at         timestamptz not null default now(),
  propina_at            timestamptz,
  pagada_at             timestamptz,
  confirmada_at         timestamptz,
  confirmada_por        uuid references public.empleados(id),
  notif_solicitud_ok    boolean,
  notif_pago_ok         boolean,
  notif_ultimo_error    text,
  updated_at            timestamptz not null default now(),

  constraint cuentas_numero_uk unique (numero),
  constraint cuentas_pago_referencia_uk unique (pago_referencia),
  constraint cuentas_estado_chk check (
    estado in ('pendiente_propina', 'lista_para_pagar', 'pago_pendiente_confirmacion', 'pago_confirmado')
  ),
  -- Descuento de juegos: 0 % o el porcentaje exacto del juego ganado (no acumulable)
  constraint cuentas_descuento_chk check (
       (descuento_porcentaje = 0  and descuento_juego is null)
    or (descuento_porcentaje = 10 and descuento_juego = 'bingo')
    or (descuento_porcentaje = 15 and descuento_juego = 'mayor-menor')
    or (descuento_porcentaje = 20 and descuento_juego = 'trivia')
  ),
  -- Propina: solo las cinco combinaciones de los QR oficiales
  constraint cuentas_propina_chk check (
       (propina_nivel is null        and propina_porcentaje is null)
    or (propina_nivel = 'excelente'  and propina_porcentaje = 20)
    or (propina_nivel = 'muy_bueno'  and propina_porcentaje = 15)
    or (propina_nivel = 'bueno'      and propina_porcentaje = 10)
    or (propina_nivel = 'regular'    and propina_porcentaje = 5)
    or (propina_nivel = 'malo'       and propina_porcentaje = 0)
  ),
  -- Sin propina escaneada no hay cuenta generada ni pago
  constraint cuentas_propina_requerida_chk check (
    estado = 'pendiente_propina' or propina_porcentaje is not null
  ),
  constraint cuentas_pago_chk check (
    estado not in ('pago_pendiente_confirmacion', 'pago_confirmado')
    or (pagada_at is not null and pago_referencia is not null)
  ),
  constraint cuentas_confirmacion_chk check (
    estado <> 'pago_confirmado' or confirmada_at is not null
  ),
  constraint cuentas_importes_chk check (
    subtotal >= 0 and descuento_importe >= 0 and propina_importe >= 0 and total >= 0
  )
);

comment on table public.cuentas is 'Punto 21: cuenta de una estadía (mesa + cliente), propina por QR y pago simulado.';

-- Una sola cuenta abierta por mesa (evita solicitudes duplicadas aunque se toque varias veces el botón)
create unique index if not exists cuentas_una_abierta_por_mesa_uk
  on public.cuentas (mesa_id)
  where estado <> 'pago_confirmado';

create index if not exists cuentas_cliente_idx on public.cuentas (cliente_id, solicitada_at desc);
create index if not exists cuentas_estado_idx on public.cuentas (estado, solicitada_at);

-- Relación cuenta ↔ pedidos. La PK sobre pedido_id garantiza que un pedido
-- pertenezca a una única cuenta (no se cobra dos veces el mismo consumo).
create table if not exists public.cuenta_pedidos (
  pedido_id   uuid primary key references public.pedidos(id),
  cuenta_id   uuid not null references public.cuentas(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists cuenta_pedidos_cuenta_idx on public.cuenta_pedidos (cuenta_id);

-- Detalle congelado de la cuenta (nombre y precio unitario registrados en el pedido),
-- para que una modificación posterior del menú no altere una cuenta ya emitida.
create table if not exists public.cuenta_items (
  id               uuid primary key default gen_random_uuid(),
  cuenta_id        uuid not null references public.cuentas(id) on delete cascade,
  pedido_id        uuid not null references public.pedidos(id),
  pedido_item_id   uuid references public.pedido_items(id) on delete set null,
  producto_id      uuid references public.productos(id) on delete set null,
  nombre           text not null,
  tipo             text,
  cantidad         integer not null check (cantidad > 0),
  precio_unitario  numeric(12,2) not null check (precio_unitario >= 0),
  importe          numeric(12,2) generated always as (round(cantidad * precio_unitario, 2)) stored
);

create index if not exists cuenta_items_cuenta_idx on public.cuenta_items (cuenta_id);

-- -------------------------------------------------------------------------------------
-- 3. FUNCIONES INTERNAS (no expuestas a la app)
-- -------------------------------------------------------------------------------------

-- Interpreta el contenido de un QR de propina. Solo acepta los cinco códigos oficiales.
create or replace function public.fn_interpretar_qr_propina(
  p_codigo text,
  out nivel text,
  out porcentaje smallint
)
language plpgsql
immutable
set search_path = public
as $$
begin
  case upper(btrim(coalesce(p_codigo, '')))
    when 'BASILICO:PROPINA:EXCELENTE:20' then nivel := 'excelente'; porcentaje := 20;
    when 'BASILICO:PROPINA:MUY_BUENO:15' then nivel := 'muy_bueno'; porcentaje := 15;
    when 'BASILICO:PROPINA:BUENO:10'     then nivel := 'bueno';     porcentaje := 10;
    when 'BASILICO:PROPINA:REGULAR:5'    then nivel := 'regular';   porcentaje := 5;
    when 'BASILICO:PROPINA:MALO:0'       then nivel := 'malo';      porcentaje := 0;
    else
      raise exception 'QR_PROPINA_INVALIDO'
        using hint = 'El código escaneado no es un QR de propina de Basílico.';
  end case;
end;
$$;

-- Aplica el descuento obtenido en los juegos respetando las reglas del enunciado:
--   * solo clientes registrados (el perfil 'anonimo' nunca recibe descuento),
--   * no acumulable: si la cuenta ya tiene un descuento se conserva el primero,
--   * el porcentaje debe corresponder al juego (bingo 10, mayor-menor 15, trivia 20).
-- Un valor inválido se ignora (no bloquea la cuenta) y la cuenta queda sin descuento.
create or replace function public.fn_aplicar_descuento_juego(
  p_cuenta_id uuid,
  p_porcentaje integer,
  p_juego text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cuenta public.cuentas%rowtype;
  v_perfil text;
begin
  if coalesce(p_porcentaje, 0) = 0 or p_juego is null then
    return;
  end if;

  select * into v_cuenta from public.cuentas where id = p_cuenta_id;
  if not found or v_cuenta.descuento_porcentaje > 0 then
    return;
  end if;

  select lower(coalesce(perfil, '')) into v_perfil from public.clientes where id = v_cuenta.cliente_id;
  if v_perfil = 'anonimo' then
    return;
  end if;

  if not (   (p_porcentaje = 10 and p_juego = 'bingo')
          or (p_porcentaje = 15 and p_juego = 'mayor-menor')
          or (p_porcentaje = 20 and p_juego = 'trivia')) then
    return;
  end if;

  update public.cuentas
     set descuento_porcentaje = p_porcentaje,
         descuento_juego = p_juego,
         updated_at = now()
   where id = p_cuenta_id;
end;
$$;

-- Regenera el detalle congelado desde pedido_items y recalcula los importes.
create or replace function public.fn_recalcular_cuenta(p_cuenta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cuenta    public.cuentas%rowtype;
  v_subtotal  numeric(12,2);
  v_descuento numeric(12,2);
  v_propina   numeric(12,2);
begin
  select * into v_cuenta from public.cuentas where id = p_cuenta_id for update;
  if not found then
    raise exception 'CUENTA_INEXISTENTE' using hint = 'No se encontró la cuenta.';
  end if;

  if v_cuenta.estado in ('pago_pendiente_confirmacion', 'pago_confirmado') then
    raise exception 'CUENTA_YA_PAGADA' using hint = 'La cuenta ya fue pagada y no puede modificarse.';
  end if;

  delete from public.cuenta_items where cuenta_id = p_cuenta_id;

  insert into public.cuenta_items (cuenta_id, pedido_id, pedido_item_id, producto_id, nombre, tipo, cantidad, precio_unitario)
  select p_cuenta_id,
         pi.pedido_id,
         pi.id,
         pi.producto_id,
         coalesce(pr.nombre, 'Producto'),
         pr.tipo,
         pi.cantidad,
         coalesce(pi.precio_unitario, pr.precio, 0)
  from public.cuenta_pedidos cp
  join public.pedido_items pi on pi.pedido_id = cp.pedido_id
  left join public.productos pr on pr.id = pi.producto_id
  where cp.cuenta_id = p_cuenta_id
    and pi.cantidad > 0;

  select coalesce(sum(importe), 0) into v_subtotal
  from public.cuenta_items
  where cuenta_id = p_cuenta_id;

  v_descuento := round(v_subtotal * v_cuenta.descuento_porcentaje / 100.0, 2);
  v_propina   := round((v_subtotal - v_descuento) * coalesce(v_cuenta.propina_porcentaje, 0) / 100.0, 2);

  update public.cuentas
     set subtotal = v_subtotal,
         descuento_importe = v_descuento,
         propina_importe = v_propina,
         total = v_subtotal - v_descuento + v_propina,
         updated_at = now()
   where id = p_cuenta_id;
end;
$$;

-- -------------------------------------------------------------------------------------
-- 4. RPC EXPUESTAS A LA APP
-- -------------------------------------------------------------------------------------

-- 4.1 El cliente solicita la cuenta (idempotente: si ya hay una abierta, la devuelve).
--     p_pedido_id: pedido activo que el cliente ve como recibido en su pantalla.
--     Se incluyen ese pedido y los demás pedidos entregados/recibidos de la mesa que
--     estén explícitamente asociados al cliente y no pertenezcan a otra cuenta.
create or replace function public.solicitar_cuenta(
  p_mesa_id uuid,
  p_pedido_id uuid,
  p_descuento_porcentaje integer default 0,
  p_descuento_juego text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente   uuid := public.fn_cliente_actual_id();
  v_mesa      public.mesas%rowtype;
  v_pedido    public.pedidos%rowtype;
  v_cuenta    public.cuentas%rowtype;
  v_en_curso  integer;
  v_cantidad  integer;
begin
  if v_cliente is null then
    raise exception 'CLIENTE_NO_IDENTIFICADO' using hint = 'No pudimos identificar tu sesión. Volvé a ingresar a la aplicación.';
  end if;

  -- Bloqueo de la mesa: serializa solicitudes simultáneas desde distintos dispositivos
  select * into v_mesa from public.mesas where id = p_mesa_id for update;
  if not found then
    raise exception 'MESA_INEXISTENTE' using hint = 'La mesa indicada no existe.';
  end if;

  if v_mesa.cliente_id is distinct from v_cliente then
    raise exception 'MESA_NO_ASIGNADA' using hint = 'Esta mesa no está asignada a tu usuario.';
  end if;

  -- ¿Ya existe una cuenta abierta para la mesa? → idempotencia
  select * into v_cuenta
  from public.cuentas
  where mesa_id = p_mesa_id and estado <> 'pago_confirmado'
  limit 1;

  if found then
    if v_cuenta.cliente_id <> v_cliente then
      raise exception 'CUENTA_DE_OTRO_CLIENTE' using hint = 'La cuenta de esta mesa pertenece a otro cliente.';
    end if;

    if v_cuenta.estado in ('pendiente_propina', 'lista_para_pagar') then
      perform public.fn_aplicar_descuento_juego(v_cuenta.id, p_descuento_porcentaje, p_descuento_juego);
      perform public.fn_recalcular_cuenta(v_cuenta.id);
    end if;

    return json_build_object('cuenta_id', v_cuenta.id, 'ya_existia', true);
  end if;

  -- Pedido de referencia
  select * into v_pedido from public.pedidos where id = p_pedido_id;
  if not found then
    raise exception 'PEDIDO_INEXISTENTE' using hint = 'No se encontró tu pedido.';
  end if;

  if v_pedido.mesa_id is distinct from p_mesa_id
     or (v_pedido.cliente_id is not null and v_pedido.cliente_id <> v_cliente) then
    raise exception 'PEDIDO_AJENO' using hint = 'El pedido no corresponde a tu mesa.';
  end if;

  if v_pedido.estado not in ('entregado', 'recibido') then
    raise exception 'PEDIDO_NO_RECIBIDO' using hint = 'Primero tenés que recibir y confirmar tu pedido.';
  end if;

  if exists (select 1 from public.cuenta_pedidos where pedido_id = p_pedido_id) then
    raise exception 'PEDIDO_YA_FACTURADO' using hint = 'Ese pedido ya forma parte de otra cuenta.';
  end if;

  -- Otros pedidos del mismo cliente en esta mesa que todavía se están preparando
  select count(*) into v_en_curso
  from public.pedidos p
  where p.mesa_id = p_mesa_id
    and p.cliente_id = v_cliente
    and p.id <> p_pedido_id
    and p.estado in ('enviado', 'pendiente', 'rechazado', 'confirmado', 'listo')
    and not exists (select 1 from public.cuenta_pedidos cp where cp.pedido_id = p.id);

  if v_en_curso > 0 then
    raise exception 'PEDIDOS_EN_CURSO' using hint = 'Tenés pedidos que todavía no fueron entregados.';
  end if;

  insert into public.cuentas (mesa_id, cliente_id, numero_mesa)
  values (p_mesa_id, v_cliente, v_mesa.numero)
  returning * into v_cuenta;

  insert into public.cuenta_pedidos (cuenta_id, pedido_id)
  select v_cuenta.id, p.id
  from public.pedidos p
  where p.mesa_id = p_mesa_id
    and p.estado in ('entregado', 'recibido')
    and (p.id = p_pedido_id or p.cliente_id = v_cliente)
    and not exists (select 1 from public.cuenta_pedidos cp where cp.pedido_id = p.id);

  get diagnostics v_cantidad = row_count;
  if v_cantidad = 0 then
    raise exception 'SIN_PEDIDOS_RECIBIDOS' using hint = 'No hay consumos recibidos para facturar.';
  end if;

  perform public.fn_aplicar_descuento_juego(v_cuenta.id, p_descuento_porcentaje, p_descuento_juego);
  perform public.fn_recalcular_cuenta(v_cuenta.id);

  return json_build_object('cuenta_id', v_cuenta.id, 'ya_existia', false);
end;
$$;

-- 4.2 El cliente escanea un QR de propina. El servidor interpreta el QR: la app nunca
--     envía un porcentaje. Se puede volver a escanear mientras la cuenta no esté pagada.
create or replace function public.registrar_propina_cuenta(
  p_cuenta_id uuid,
  p_codigo_qr text,
  p_descuento_porcentaje integer default 0,
  p_descuento_juego text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente uuid := public.fn_cliente_actual_id();
  v_cuenta  public.cuentas%rowtype;
  v_qr      record;
begin
  select * into v_cuenta from public.cuentas where id = p_cuenta_id for update;
  if not found then
    raise exception 'CUENTA_INEXISTENTE' using hint = 'No se encontró la cuenta.';
  end if;

  if v_cliente is null or v_cuenta.cliente_id <> v_cliente then
    raise exception 'CUENTA_DE_OTRO_CLIENTE' using hint = 'Esta cuenta no te pertenece.';
  end if;

  if v_cuenta.estado in ('pago_pendiente_confirmacion', 'pago_confirmado') then
    raise exception 'CUENTA_YA_PAGADA' using hint = 'La cuenta ya fue pagada: no se puede modificar la propina.';
  end if;

  select * into v_qr from public.fn_interpretar_qr_propina(p_codigo_qr);

  update public.cuentas
     set propina_nivel = v_qr.nivel,
         propina_porcentaje = v_qr.porcentaje,
         propina_at = now(),
         estado = 'lista_para_pagar',
         updated_at = now()
   where id = p_cuenta_id;

  perform public.fn_aplicar_descuento_juego(p_cuenta_id, p_descuento_porcentaje, p_descuento_juego);
  perform public.fn_recalcular_cuenta(p_cuenta_id);

  return json_build_object(
    'cuenta_id', p_cuenta_id,
    'propina_nivel', v_qr.nivel,
    'propina_porcentaje', v_qr.porcentaje
  );
end;
$$;

-- 4.3 Pago simulado. Idempotente: un segundo intento no genera otro pago.
--     p_total_esperado: total que el cliente vio en pantalla. Si la cuenta cambió,
--     no se cobra y se devuelve el total actualizado para que lo revise.
create or replace function public.pagar_cuenta(
  p_cuenta_id uuid,
  p_total_esperado numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente    uuid := public.fn_cliente_actual_id();
  v_cuenta     public.cuentas%rowtype;
  v_referencia text;
begin
  select * into v_cuenta from public.cuentas where id = p_cuenta_id for update;
  if not found then
    raise exception 'CUENTA_INEXISTENTE' using hint = 'No se encontró la cuenta.';
  end if;

  if v_cliente is null or v_cuenta.cliente_id <> v_cliente then
    raise exception 'CUENTA_DE_OTRO_CLIENTE' using hint = 'No podés pagar la cuenta de otra mesa.';
  end if;

  if v_cuenta.estado in ('pago_pendiente_confirmacion', 'pago_confirmado') then
    return json_build_object(
      'ok', true,
      'ya_pagada', true,
      'pago_referencia', v_cuenta.pago_referencia,
      'total', v_cuenta.total
    );
  end if;

  if v_cuenta.estado = 'pendiente_propina' or v_cuenta.propina_porcentaje is null then
    raise exception 'PROPINA_REQUERIDA' using hint = 'Escaneá un QR de propina antes de pagar.';
  end if;

  perform public.fn_recalcular_cuenta(p_cuenta_id);
  select * into v_cuenta from public.cuentas where id = p_cuenta_id;

  if p_total_esperado is null or round(p_total_esperado, 2) <> v_cuenta.total then
    return json_build_object(
      'ok', false,
      'motivo', 'TOTAL_DESACTUALIZADO',
      'total', v_cuenta.total
    );
  end if;

  v_referencia := 'SIM-' || lpad(v_cuenta.numero::text, 6, '0') || '-'
                  || to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYYMMDDHH24MISS');

  update public.cuentas
     set estado = 'pago_pendiente_confirmacion',
         pagada_at = now(),
         pago_referencia = v_referencia,
         updated_at = now()
   where id = p_cuenta_id;

  return json_build_object(
    'ok', true,
    'ya_pagada', false,
    'pago_referencia', v_referencia,
    'total', v_cuenta.total
  );
end;
$$;

-- 4.4 Registro del resultado del envío de la push (permite reintentar el aviso sin
--     volver a cobrar). Solo el cliente dueño de la cuenta.
create or replace function public.marcar_notificacion_cuenta(
  p_cuenta_id uuid,
  p_evento text,
  p_ok boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente uuid := public.fn_cliente_actual_id();
begin
  if p_evento not in ('solicitud', 'pago') then
    raise exception 'EVENTO_INVALIDO';
  end if;

  update public.cuentas
     set notif_solicitud_ok = case when p_evento = 'solicitud' then p_ok else notif_solicitud_ok end,
         notif_pago_ok      = case when p_evento = 'pago'      then p_ok else notif_pago_ok end,
         notif_ultimo_error = case when p_ok then notif_ultimo_error else left(coalesce(p_error, 'Error desconocido'), 500) end,
         updated_at = now()
   where id = p_cuenta_id
     and cliente_id = v_cliente;
end;
$$;

-- 4.5 El mozo confirma el pago (separado del pago del cliente; idempotente).
--     Base del Punto 22: libera la mesa y cierra los pedidos de la cuenta.
--     La factura PDF y el correo del Punto 22 NO se implementan acá: el json devuelto
--     trae los datos necesarios para dispararlos más adelante.
create or replace function public.confirmar_pago_cuenta(p_cuenta_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil text := public.fn_perfil_empleado_actual();
  v_cuenta public.cuentas%rowtype;
begin
  if v_perfil is distinct from 'mozo' then
    raise exception 'SOLO_MOZO' using hint = 'Solo un mozo puede confirmar el pago.';
  end if;

  select * into v_cuenta from public.cuentas where id = p_cuenta_id for update;
  if not found then
    raise exception 'CUENTA_INEXISTENTE' using hint = 'No se encontró la cuenta.';
  end if;

  if v_cuenta.estado = 'pago_confirmado' then
    return json_build_object('cuenta_id', v_cuenta.id, 'ya_confirmada', true,
                             'cliente_id', v_cuenta.cliente_id, 'numero_mesa', v_cuenta.numero_mesa,
                             'total', v_cuenta.total);
  end if;

  if v_cuenta.estado <> 'pago_pendiente_confirmacion' then
    raise exception 'PAGO_NO_REALIZADO' using hint = 'El cliente todavía no realizó el pago.';
  end if;

  update public.cuentas
     set estado = 'pago_confirmado',
         confirmada_at = now(),
         confirmada_por = public.fn_empleado_actual_id(),
         updated_at = now()
   where id = p_cuenta_id;

  -- Se libera la mesa solo si sigue asociada al cliente de esta cuenta
  update public.mesas
     set disponibilidad = 'libre',
         cliente_id = null
   where id = v_cuenta.mesa_id
     and cliente_id = v_cuenta.cliente_id;

  -- Cierre de los pedidos facturados (si la restricción de estados no admite
  -- 'pagado' se usa 'finalizado', el mismo valor que ya usa la app).
  begin
    update public.pedidos set estado = 'pagado'
     where id in (select pedido_id from public.cuenta_pedidos where cuenta_id = p_cuenta_id);
  exception when check_violation then
    begin
      update public.pedidos set estado = 'finalizado'
       where id in (select pedido_id from public.cuenta_pedidos where cuenta_id = p_cuenta_id);
    exception when check_violation then
      null;
    end;
  end;

  return json_build_object('cuenta_id', v_cuenta.id, 'ya_confirmada', false,
                           'cliente_id', v_cuenta.cliente_id, 'numero_mesa', v_cuenta.numero_mesa,
                           'total', v_cuenta.total);
end;
$$;

-- -------------------------------------------------------------------------------------
-- 5. PROTECCIÓN DE PEDIDOS INCLUIDOS EN UNA CUENTA PAGADA
-- -------------------------------------------------------------------------------------
create or replace function public.fn_proteger_pedido_pagado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido_id uuid;
begin
  if tg_table_name = 'pedido_items' then
    if tg_op = 'DELETE' then v_pedido_id := old.pedido_id; else v_pedido_id := new.pedido_id; end if;
  else
    if tg_op = 'DELETE' then v_pedido_id := old.id; else v_pedido_id := new.id; end if;
  end if;

  if exists (
    select 1
    from public.cuenta_pedidos cp
    join public.cuentas c on c.id = cp.cuenta_id
    where cp.pedido_id = v_pedido_id
      and c.estado in ('pago_pendiente_confirmacion', 'pago_confirmado')
  ) then
    raise exception 'PEDIDO_EN_CUENTA_PAGADA'
      using hint = 'El pedido pertenece a una cuenta pagada y no puede modificarse.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_items_cuenta_pagada on public.pedido_items;
create trigger trg_proteger_items_cuenta_pagada
  before insert or update or delete on public.pedido_items
  for each row execute function public.fn_proteger_pedido_pagado();

drop trigger if exists trg_proteger_pedido_cuenta_pagada on public.pedidos;
create trigger trg_proteger_pedido_cuenta_pagada
  before update of importe_total, mesa_id or delete on public.pedidos
  for each row execute function public.fn_proteger_pedido_pagado();

-- -------------------------------------------------------------------------------------
-- 6. SEGURIDAD: RLS Y PERMISOS
--    Lectura: el cliente ve solo sus cuentas; mozo, dueño y supervisor ven todas.
--    Escritura: únicamente a través de las funciones RPC anteriores.
-- -------------------------------------------------------------------------------------
alter table public.cuentas        enable row level security;
alter table public.cuenta_pedidos enable row level security;
alter table public.cuenta_items   enable row level security;

drop policy if exists cuentas_select_cliente on public.cuentas;
create policy cuentas_select_cliente on public.cuentas
  for select to authenticated
  using (cliente_id = public.fn_cliente_actual_id());

drop policy if exists cuentas_select_personal on public.cuentas;
create policy cuentas_select_personal on public.cuentas
  for select to authenticated
  using (public.fn_perfil_empleado_actual() in ('mozo', 'duenio', 'supervisor'));

drop policy if exists cuenta_pedidos_select on public.cuenta_pedidos;
create policy cuenta_pedidos_select on public.cuenta_pedidos
  for select to authenticated
  using (exists (select 1 from public.cuentas c where c.id = cuenta_id));

drop policy if exists cuenta_items_select on public.cuenta_items;
create policy cuenta_items_select on public.cuenta_items
  for select to authenticated
  using (exists (select 1 from public.cuentas c where c.id = cuenta_id));

revoke all on public.cuentas, public.cuenta_pedidos, public.cuenta_items from anon;
revoke insert, update, delete, truncate on public.cuentas, public.cuenta_pedidos, public.cuenta_items from authenticated;
grant select on public.cuentas, public.cuenta_pedidos, public.cuenta_items to authenticated;

-- Funciones internas: nadie las invoca directamente desde la app
revoke execute on function public.fn_aplicar_descuento_juego(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.fn_recalcular_cuenta(uuid) from public, anon, authenticated;
revoke execute on function public.fn_proteger_pedido_pagado() from public, anon, authenticated;

-- Funciones de identidad (usadas por las políticas) y RPC: solo usuarios autenticados
revoke execute on function public.fn_cliente_actual_id() from public, anon;
revoke execute on function public.fn_empleado_actual_id() from public, anon;
revoke execute on function public.fn_perfil_empleado_actual() from public, anon;
revoke execute on function public.fn_interpretar_qr_propina(text) from public, anon;
revoke execute on function public.solicitar_cuenta(uuid, uuid, integer, text) from public, anon;
revoke execute on function public.registrar_propina_cuenta(uuid, text, integer, text) from public, anon;
revoke execute on function public.pagar_cuenta(uuid, numeric) from public, anon;
revoke execute on function public.marcar_notificacion_cuenta(uuid, text, boolean, text) from public, anon;
revoke execute on function public.confirmar_pago_cuenta(uuid) from public, anon;

grant execute on function public.fn_cliente_actual_id() to authenticated;
grant execute on function public.fn_empleado_actual_id() to authenticated;
grant execute on function public.fn_perfil_empleado_actual() to authenticated;
grant execute on function public.fn_interpretar_qr_propina(text) to authenticated;
grant execute on function public.solicitar_cuenta(uuid, uuid, integer, text) to authenticated;
grant execute on function public.registrar_propina_cuenta(uuid, text, integer, text) to authenticated;
grant execute on function public.pagar_cuenta(uuid, numeric) to authenticated;
grant execute on function public.marcar_notificacion_cuenta(uuid, text, boolean, text) to authenticated;
grant execute on function public.confirmar_pago_cuenta(uuid) to authenticated;

-- -------------------------------------------------------------------------------------
-- 7. REALTIME (la lista del mozo y la pantalla del cliente se actualizan solas)
-- -------------------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.cuentas;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

commit;

-- =====================================================================================
--  VERIFICACIONES RECOMENDADAS (ejecutar a mano después de aplicar; solo lectura)
-- =====================================================================================
-- 1) ¿A qué tabla apunta pedidos.cliente_id? (la app ahora intenta guardar clientes.id)
--    select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.pedidos'::regclass and contype = 'f';
--
-- 2) ¿Qué estados admite pedidos.estado? (para 'recibido', 'pagado', 'finalizado')
--    select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.pedidos'::regclass and contype = 'c';
--
-- 3) ¿Qué valores admite mesas.disponibilidad? (confirmar 'libre')
--    select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.mesas'::regclass and contype = 'c';
--
-- 4) Prueba del intérprete de QR:
--    select * from public.fn_interpretar_qr_propina('BASILICO:PROPINA:MALO:0');   -- malo / 0
--    select * from public.fn_interpretar_qr_propina('mesa_numero:3');             -- error QR_PROPINA_INVALIDO
--
-- =====================================================================================
--  REVERSIÓN (solo si fuese necesario deshacer el Punto 21)
-- =====================================================================================
--  drop trigger if exists trg_proteger_items_cuenta_pagada on public.pedido_items;
--  drop trigger if exists trg_proteger_pedido_cuenta_pagada on public.pedidos;
--  drop function if exists public.confirmar_pago_cuenta(uuid), public.marcar_notificacion_cuenta(uuid, text, boolean, text),
--    public.pagar_cuenta(uuid, numeric), public.registrar_propina_cuenta(uuid, text, integer, text),
--    public.solicitar_cuenta(uuid, uuid, integer, text), public.fn_recalcular_cuenta(uuid),
--    public.fn_aplicar_descuento_juego(uuid, integer, text), public.fn_interpretar_qr_propina(text),
--    public.fn_proteger_pedido_pagado();
--  drop table if exists public.cuenta_items, public.cuenta_pedidos, public.cuentas;
