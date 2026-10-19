-- =====================================================================================
--  PUNTO 21 — CORRECCIÓN: mesas.cliente_id es de tipo text (no uuid)
-- =====================================================================================
--  Error en producción: "operator does not exist: text = uuid" al pedir la cuenta.
--  Las comparaciones con mesas.cliente_id (y, por las dudas, con pedidos.cliente_id)
--  se hacen como texto, de modo que funcionan sea cual sea el tipo de la columna.
--  Reemplaza solicitar_cuenta y confirmar_pago_cuenta; no toca datos.
-- =====================================================================================

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

  select * into v_mesa from public.mesas where id = p_mesa_id for update;
  if not found then
    raise exception 'MESA_INEXISTENTE' using hint = 'La mesa indicada no existe.';
  end if;

  if v_mesa.cliente_id::text is distinct from v_cliente::text then
    raise exception 'MESA_NO_ASIGNADA' using hint = 'Esta mesa no está asignada a tu usuario.';
  end if;

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

  select * into v_pedido from public.pedidos where id = p_pedido_id;
  if not found then
    raise exception 'PEDIDO_INEXISTENTE' using hint = 'No se encontró tu pedido.';
  end if;

  if v_pedido.mesa_id is distinct from p_mesa_id
     or (v_pedido.cliente_id is not null and v_pedido.cliente_id::text <> v_cliente::text) then
    raise exception 'PEDIDO_AJENO' using hint = 'El pedido no corresponde a tu mesa.';
  end if;

  if v_pedido.estado not in ('entregado', 'recibido') then
    raise exception 'PEDIDO_NO_RECIBIDO' using hint = 'Primero tenés que recibir y confirmar tu pedido.';
  end if;

  if exists (select 1 from public.cuenta_pedidos where pedido_id = p_pedido_id) then
    raise exception 'PEDIDO_YA_FACTURADO' using hint = 'Ese pedido ya forma parte de otra cuenta.';
  end if;

  select count(*) into v_en_curso
  from public.pedidos p
  where p.mesa_id = p_mesa_id
    and p.cliente_id::text = v_cliente::text
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
    and (p.id = p_pedido_id or p.cliente_id::text = v_cliente::text)
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

  update public.mesas
     set disponibilidad = 'vacia',
         cliente_id = null
   where id = v_cuenta.mesa_id
     and cliente_id::text = v_cuenta.cliente_id::text;

  update public.pedidos
     set estado = 'pagado'
   where id in (select pedido_id from public.cuenta_pedidos where cuenta_id = p_cuenta_id);

  return json_build_object('cuenta_id', v_cuenta.id, 'ya_confirmada', false,
                           'cliente_id', v_cuenta.cliente_id, 'numero_mesa', v_cuenta.numero_mesa,
                           'total', v_cuenta.total);
end;
$$;

revoke execute on function public.solicitar_cuenta(uuid, uuid, integer, text) from public, anon;
revoke execute on function public.confirmar_pago_cuenta(uuid) from public, anon;
grant execute on function public.solicitar_cuenta(uuid, uuid, integer, text) to authenticated;
grant execute on function public.confirmar_pago_cuenta(uuid) to authenticated;
