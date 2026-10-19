-- =====================================================================================
--  PUNTO 21 — CORRECCIÓN: la mesa liberada debe quedar 'vacia' (no 'libre')
-- =====================================================================================
--  La restricción real es:
--    mesas_disponibilidad_check: disponibilidad IN ('vacia', 'asignada', 'ocupada')
--  y la restricción de pedidos admite 'pagado', por lo que se usa directamente.
--  Solo reemplaza la función confirmar_pago_cuenta; no toca datos.
-- =====================================================================================

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
     set disponibilidad = 'vacia',
         cliente_id = null
   where id = v_cuenta.mesa_id
     and cliente_id = v_cuenta.cliente_id;

  update public.pedidos
     set estado = 'pagado'
   where id in (select pedido_id from public.cuenta_pedidos where cuenta_id = p_cuenta_id);

  return json_build_object('cuenta_id', v_cuenta.id, 'ya_confirmada', false,
                           'cliente_id', v_cuenta.cliente_id, 'numero_mesa', v_cuenta.numero_mesa,
                           'total', v_cuenta.total);
end;
$$;

revoke execute on function public.confirmar_pago_cuenta(uuid) from public, anon;
grant execute on function public.confirmar_pago_cuenta(uuid) to authenticated;
