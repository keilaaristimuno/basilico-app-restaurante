import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Producto } from '../interfaces/producto';
import { PedidoSupabaseRelacional } from '../interfaces/pedido';

@Injectable({
  providedIn: 'root',
})

export class Supabase {

  clienteSupabase: SupabaseClient; 

  constructor(private router:Router){
    this.clienteSupabase = createClient('https://xmlcpvfjlnuakqehrvom.supabase.co','sb_publishable_0CIgFJfBexfQGT_C2l-Qbw_N8Dh05lZ');
  }
  //Para registrar un usuario con SupB (Metodo SingUp)
  registrar(correo: string, contraseña: string){
    return this.clienteSupabase.auth.signUp({
      email: correo,
      password: contraseña,
    });
  }

  //login
  //Para iniciar sesión con SupB (Metodo SignInWhithPassword)
  iniciarSesion(correo: string, contraseña:string){
    return this.clienteSupabase.auth.signInWithPassword({
      email: correo,
      password: contraseña
    });
  }

  cerrarSesion(){
    return this.clienteSupabase.auth.signOut();
  }

  //registrar (Se guardan en la BD)
  //Para guardar un usuario cuando se registra
  async guardarDatosEmpleados(apellidos: string, nombres: string, dni:number, cuil:number, correo:string, clave:string, perfil:string, foto_url:string){
    const { data, error } = await this.clienteSupabase
      .from('empleados')
      .insert([
        {
          apellidos: apellidos,
          nombres: nombres,
          dni: dni,
          cuil: cuil,
          correo: correo,
          clave: clave,
          perfil: perfil,
          foto_url: foto_url
        }
      ]);

    if (error) {
      console.error('Error al guardar empleado:', error.message);
      throw new Error(error.message);
    }

    return data;
  }

  async guardarDatosClientes(
    apellidos: string | null,
    nombres: string | null,
    dni: number | null,
    correo: string | null,
    clave: string | null,
    foto_url: string | null,
    perfil: string | null,
    estado: string | null,
  ) {
    const { data, error } = await this.clienteSupabase
      .from('clientes')
      .insert([{
        apellidos,
        nombres,
        dni,
        correo,
        clave,
        foto_url,
        perfil,
        estado,
      }]);

    if (error) {
      console.error('Error al guardar cliente:', error.message);
      throw new Error(error.message);
    }

    return data;
  }

  async guardarMesa(numero: number, cantidadComensales: number, tipo: string, disponibilidad: string, fotoUrl: string, qr:string) {
    const { data, error } = await this.clienteSupabase
      .from('mesas')
      .insert([
        {
          numero,
          cantidad_comensales: cantidadComensales,
          tipo,
          disponibilidad,
          foto_url: fotoUrl,
          qr,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      throw new Error(`Error al guardar la mesa: ${error.message}`);
    }

    return data;
  }

  async obtenerMesas() {
    const { data, error } = await this.clienteSupabase
      .from('mesas')
      .select('*')
      .order('numero', { ascending: true });

    if (error) {
      throw new Error(`Error al obtener las mesas: ${error.message}`);
    }

    return data ?? [];
  }

  async actualizarDisponibilidadMesa(id: string, disponibilidad: string) {
    const { data, error } = await this.clienteSupabase
      .from('mesas')
      .update({ disponibilidad })
      .eq('id', id)
      .select();

    if (error) {
      throw new Error(`Error al actualizar la mesa: ${error.message}`);
    }

    return data;
  }

  async liberarMesa(id: string) {
    const { data, error } = await this.clienteSupabase
      .from('mesas')
      .update({ disponibilidad: 'libre', cliente_id: null })
      .eq('id', id)
      .select();

    if (error) {
      throw new Error(`Error al liberar la mesa: ${error.message}`);
    }

    return data;
  }
  async obtenerPerfilUsuarioLogueado() {
    const { data: { user } } = await this.clienteSupabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await this.clienteSupabase
      .from('perfiles_completos')
      .select('nombres, perfil')
      .eq('mail', user.email)
      .single();

    if (error) {
      console.error('Error al obtener perfil:', error.message);
      return null;
    }

    return data;
  }
//Para subir foto a Supabase Storage
  async subirFotoProducto(webPath: string, nombreArchivo: string) {
    const respuesta = await fetch(webPath);
    const blob = await respuesta.blob();
    const { data, error } = await this.clienteSupabase.storage
    .from('productos') // Nombre del bucket
    .upload(nombreArchivo, blob);

    if (error) {
      throw Error(`Error al subir la foto: ${error.message}`);
    }
    return data;
  }

  //Para obtener la URL pública de una foto en Supabase Storage
  obtenerUrlFotoProducto(ruta: string) {
    const {data} = this.clienteSupabase.storage
    .from('productos') // Nombre del bucket
    .getPublicUrl(ruta);

    return data.publicUrl;
  }

  async guardarPlato(nombre: string, 
    descripcion: string,
    tiempoElaboracion: number, 
    precio: number, 
    fotos: string[]
  ){
    const { data, error } = await this.clienteSupabase
    .from('productos')
    .insert([
      {
        tipo: 'plato',
        nombre: nombre,
        descripcion: descripcion,
        tiempo_elaboracion: tiempoElaboracion,
        precio: precio,
        fotos: fotos
      }
    ]);

    if (error) {
      throw Error(`Error al guardar el plato: ${error.message}`);
    }
    return data;
  }

  /* ====================================
          OBTIENE PRODUCTOS (plato y bebida) desde supabase
  =======================================*/
  async obtenerProductos(): Promise<Producto[]> {

    const { data, error } = await this.clienteSupabase
      .from('productos')
      .select('*')
      .order('nombre', {
        ascending: true
      });

    if (error) {
      throw Error(
        `Error al obtener los productos: ${error.message}`
      );
    }

    return (data ?? []) as Producto[];
  }

  /* ====================================
          EDITAR / ELIMINAR PRODUCTO (perfil empleado)
  =======================================*/
  async actualizarProducto(
    id: string,
    cambios: Pick<Producto, 'nombre' | 'descripcion' | 'tiempo_elaboracion' | 'precio' | 'fotos'>
  ): Promise<Producto> {
    const { data, error } = await this.clienteSupabase
      .from('productos')
      .update({
        nombre: cambios.nombre.trim(),
        descripcion: cambios.descripcion.trim(),
        tiempo_elaboracion: cambios.tiempo_elaboracion,
        precio: cambios.precio,
        fotos: cambios.fotos
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error al actualizar el producto: ${error.message}`);
    }
    return data as Producto;
  }

  async eliminarProducto(id: string): Promise<void> {
    const { error } = await this.clienteSupabase
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) {
      // 23503: el producto está referenciado por pedidos existentes (clave foránea)
      if (error.code === '23503') {
        throw new Error('No se puede eliminar: el producto forma parte de pedidos registrados.');
      }
      throw new Error(`Error al eliminar el producto: ${error.message}`);
    }
  }

  /**
   * Borra del bucket 'productos' los archivos correspondientes a las URLs públicas recibidas.
   * Ignora las URLs que no pertenecen al bucket.
   */
  async eliminarFotosProducto(urls: string[]): Promise<void> {
    const marcador = '/storage/v1/object/public/productos/';
    const rutas = urls
      .map(url => {
        const indice = url.indexOf(marcador);
        if (indice === -1) return '';
        return decodeURIComponent(url.substring(indice + marcador.length).split('?')[0]);
      })
      .filter(ruta => ruta !== '');

    if (rutas.length === 0) return;

    const { error } = await this.clienteSupabase.storage
      .from('productos')
      .remove(rutas);

    if (error) {
      throw new Error(`Error al eliminar las fotos: ${error.message}`);
    }
  }

  //verificar si un plato ya existe en la base de datos por su nombre
  async platoExiste(nombre: string) {
    const { data, error } = await this.clienteSupabase
      .from('productos')
      .select('id')
      .eq('tipo', 'plato')
      .like('nombre', nombre.trim())
      .limit(1);

    if (error) {
      throw Error(`Error al verificar existencia del plato: ${error.message}`);
    }
    return data.length > 0; // Retorna true si el plato existe, false si no 
  }

  /* =============================
        GUARDAR BEBIDA
    ============================= */
  async guardarBebida(
    nombre: string,
    descripcion: string,
    tiempoElaboracion: number,
    precio: number,
    fotos: string[]
  ) {
    const { data, error } = await this.clienteSupabase
      .from('productos')
      .insert([{
        tipo: 'bebida',
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        tiempo_elaboracion: tiempoElaboracion,
        precio,
        fotos
      }]);

    if (error) {
      throw new Error(`Error al guardar la bebida: ${error.message}`);
    }
    return data;
  }

  async bebidaExiste(nombre: string): Promise<boolean> {
    const { data, error } = await this.clienteSupabase
      .from('productos')
      .select('id')
      .eq('tipo', 'bebida')
      .eq('nombre', nombre.trim())
      .limit(1);

    if (error) {
      throw new Error(`Error al verificar la bebida: ${error.message}`);
    }

    return (data?.length ?? 0) > 0;
  }

  /* =========================
        FOTO EMPLEADO
    ========================== */

  // Para subir la foto del empleado a Supabase Storage (bucket 'empleados')
  async subirFotoEmpleado(rutaFoto: string, nombreArchivo: string) {
    const respuesta = await fetch(rutaFoto);
    const blob = await respuesta.blob();
    const { data, error } = await this.clienteSupabase.storage
      .from("empleados")
      .upload(nombreArchivo, blob);

    if (error) {
      throw Error(`Error al subir la foto del empleado: ${error.message}`);
    }
    return data;
  }

  // Para obtener la URL pública de la foto del empleado en Supabase
  obtenerUrlFotoEmpleado(ruta: string) {
    const { data } = this.clienteSupabase.storage
      .from("empleados")
      .getPublicUrl(ruta);

    return data.publicUrl;
  }

  async subirFotoCliente(rutaFoto: string, nombreArchivo: string) {
    const respuesta = await fetch(rutaFoto);
    const blob = await respuesta.blob();
    const { data, error } = await this.clienteSupabase.storage
      .from('clientes')
      .upload(nombreArchivo, blob);

    if (error) {
      throw Error(`Error al subir la foto del cliente: ${error.message}`);
    }

    return data;
  }

  obtenerUrlFotoCliente(ruta: string) {
    const { data } = this.clienteSupabase.storage
      .from('clientes')
      .getPublicUrl(ruta);

    return data.publicUrl;
  }

  async subirFotoMesa(rutaFoto: string, nombreArchivo: string) {
    const respuesta = await fetch(rutaFoto);
    const blob = await respuesta.blob();
    const { data, error } = await this.clienteSupabase.storage
      .from('mesas')
      .upload(nombreArchivo, blob);

    if (error) {
      throw Error(`Error al subir la foto de la mesa: ${error.message}`);
    }

    return data;
  }

  obtenerUrlFotoMesa(ruta: string) {
    const { data } = this.clienteSupabase.storage
      .from('mesas')
      .getPublicUrl(ruta);

    return data.publicUrl;
  }

  async obtenerClientesPendientes() {
    const { data, error } = await this.clienteSupabase
      .from("clientes")
      .select("*")
      .eq("estado", "pendiente")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Error al obtener clientes pendientes: ${error.message}`);
    }

    return data ?? [];
  }

  async cambiarEstadoCliente(id: string | number, estado: "aprobado" | "rechazado") {
    const { data, error } = await this.clienteSupabase
      .from("clientes")
      .update({ estado })
      .eq("id", id)
      .select();

    if (error) {
      throw new Error(`Error al actualizar estado del cliente: ${error.message}`);
    }

    return data;
  }

  async obtenerClientePorCorreo(correo: string) {
    const { data, error } = await this.clienteSupabase
      .from("clientes")
      .select("*")
      .ilike("correo", correo.trim())
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error al consultar cliente por correo:", error.message);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  }


  //Para obtener la lista de espera desde Supabase
  async obtenerListaDeEspera() {
    const { data, error } = await this.clienteSupabase
      .from("lista_espera")
      .select("*")
      .order("created_at", { ascending: true });
  
    if (error) {
      console.error("Error al obtener la lista de espera:", error.message);
      return [];
    }

    return data;
  }

  // Para eliminar un cliente de la lista de espera en Supabase
  async eliminarDeListaDeEspera(id: string) {
    const { error } = await this.clienteSupabase
      .from('lista_espera')
      .delete()
      .or(`id.eq.${id},cliente_id.eq.${id}`);
  }

  //para asignar una mesa a un cliente en la lista de espera
  async asignarMesaACliente(clienteId: string, numeroMesa: string) {
    // Primero liberamos cualquier otra mesa que pudiera haber quedado asociada a este cliente
    try {
      await this.clienteSupabase
        .from('mesas')
        .update({
          disponibilidad: 'libre',
          cliente_id: null
        })
        .eq('cliente_id', clienteId);
    } catch (e) {
      console.warn('No se pudo limpiar mesa previa del cliente:', e);
    }

    // El metre asigna → disponibilidad pasa a 'asignada' (no 'ocupada').
    // 'ocupada' se establece recién cuando el cliente escanea el QR de la mesa.
    const { error: errorMesa } = await this.clienteSupabase
      .from('mesas')
      .update({
        disponibilidad: 'asignada',
        cliente_id: clienteId
      })
      .eq('numero', numeroMesa);

    if (errorMesa) throw errorMesa;

    // Eliminar de lista de espera filtrando por cliente_id (no por el id del registro).
    await this.eliminarClienteDeListaDeEspera(clienteId);
  }

  // Elimina el registro de lista_espera cuyo cliente_id coincide.
  async eliminarClienteDeListaDeEspera(clienteId: string) {
    const { error } = await this.clienteSupabase
      .from('lista_espera')
      .delete()
      .eq('cliente_id', clienteId);

    if (error) {
      console.error('Error al eliminar de lista de espera:', error.message);
    }
  }

  
  /* ============================================================
     OBTENER PEDIDOS CONFIRMADOS PARA COCINA (PUNTO 16)
  ============================================================ */
  async obtenerPedidosConfirmadosCocina(): Promise<PedidoSupabaseRelacional[]> {
    const { data, error } = await this.clienteSupabase
      .from('pedidos')
      .select(`
        id,
        estado,
        created_at,
        cocina_listo,
        bar_listo,
        mesas (
          id,
          numero
        ),
        pedido_items (
          id,
          cantidad,
          precio_unitario,
          productos (
            id,
            nombre,
            tipo
          )
        )
      `)
      .eq('estado', 'confirmado')
      .eq('cocina_listo', false)
      .order('created_at', { ascending: true })
      .returns<PedidoSupabaseRelacional[]>();

    if (error) {
      console.error('Error al obtener los pedidos para cocina:', error.message);
      throw new Error(`Error al obtener los pedidos para cocina: ${error.message}`);
    }

    return data ?? [];
  }

  /* ============================================================
     OBTENER PEDIDOS CONFIRMADOS PARA BAR (PUNTO 17)
  ============================================================ */
  async obtenerPedidosConfirmadosBar(): Promise<PedidoSupabaseRelacional[]> {
    const { data, error } = await this.clienteSupabase
      .from('pedidos')
      .select(`
        id,
        estado,
        created_at,
        cocina_listo,
        bar_listo,
        mesas (
          id,
          numero
        ),
        pedido_items (
          id,
          cantidad,
          precio_unitario,
          productos (
            id,
            nombre,
            tipo
          )
        )
      `)
      .eq('estado', 'confirmado')
      .eq('bar_listo', false)
      .order('created_at', { ascending: true })
      .returns<PedidoSupabaseRelacional[]>();

    if (error) {
      console.error('Error al obtener los pedidos para bar:', error.message);
      throw new Error(`Error al obtener los pedidos para bar: ${error.message}`);
    }

    return data ?? [];
  }

  /* ============================================================
     GESTIÓN DE PEDIDOS - FLUJO 11 AL 14
  ============================================================ */

  async guardarNuevoPedido(
    mesaId: string,
    clienteId: string,
    importeTotal: number,
    tiempoEstimado: number
  ) {
    const { data, error } = await this.clienteSupabase
      .from('pedidos')
      .insert([
        {
          mesa_id: mesaId,
          cliente_id: null,
          estado: 'enviado',
          importe_total: importeTotal,
          tiempo_estimado: tiempoEstimado,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error al guardar el nuevo pedido:', error.message);
      throw new Error(`Error al guardar el pedido: ${error.message}`);
    }

    return data;
  }

  async guardarItemsPedido(
    pedidoId: string,
    items: { producto_id: string; cantidad: number; precio_unitario: number }[]
  ) {
    const filas = items.map((it) => ({
      pedido_id: pedidoId,
      producto_id: it.producto_id,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario
    }));

    const { data, error } = await this.clienteSupabase
      .from('pedido_items')
      .insert(filas)
      .select();

    if (error) {
      console.error('Error al guardar los items del pedido:', error.message);
      throw new Error(`Error al guardar los productos del pedido: ${error.message}`);
    }

    return data;
  }

  async reemplazarItemsPedido(
    pedidoId: string,
    items: { producto_id: string; cantidad: number; precio_unitario: number }[]
  ) {
    const { error: errorBorrado } = await this.clienteSupabase
      .from('pedido_items')
      .delete()
      .eq('pedido_id', pedidoId);

    if (errorBorrado) {
      console.error('Error al limpiar items anteriores del pedido:', errorBorrado.message);
      throw new Error(`Error al actualizar los items: ${errorBorrado.message}`);
    }

    return this.guardarItemsPedido(pedidoId, items);
  }

  async modificarPedidoExistente(
    pedidoId: string,
    importeTotal: number,
    tiempoEstimado: number
  ) {
    const { data, error } = await this.clienteSupabase
      .from('pedidos')
      .update({
        estado: 'enviado',
        importe_total: importeTotal,
        tiempo_estimado: tiempoEstimado
      })
      .eq('id', pedidoId)
      .select()
      .single();

    if (error) {
      console.error('Error al modificar el pedido:', error.message);
      throw new Error(`Error al actualizar el pedido: ${error.message}`);
    }

    return data;
  }

  async actualizarEstadoPedido(pedidoId: string, estado: string) {
    const { data, error } = await this.clienteSupabase
      .from('pedidos')
      .update({ estado })
      .eq('id', pedidoId)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar estado del pedido:', error.message);
      throw new Error(`Error al actualizar estado del pedido: ${error.message}`);
    }

    return data;
  }

  async eliminarPedidoCompleto(pedidoId: string) {
    try {
      await this.clienteSupabase
        .from('pedido_items')
        .delete()
        .eq('pedido_id', pedidoId);
    } catch (e) {
      console.warn('Error eliminando items del pedido:', e);
    }

    const { error } = await this.clienteSupabase
      .from('pedidos')
      .delete()
      .eq('id', pedidoId);

    if (error) {
      console.warn('No se pudo eliminar el pedido en DB, intentando actualizar estado:', error.message);
      await this.clienteSupabase
        .from('pedidos')
        .update({ estado: 'finalizado' })
        .eq('id', pedidoId);
    }
  }

  /**
   * Cocina o Bar marcan su parte del pedido como lista (Punto 15).
   * La función de base de datos pasa el pedido a 'listo' solo cuando
   * todos los sectores intervinientes terminaron. Devuelve el estado final.
   */
  async marcarSectorListo(pedidoId: string, sector: 'cocina' | 'bar'): Promise<string> {
    const { data, error } = await this.clienteSupabase.rpc('marcar_sector_listo', {
      p_pedido_id: pedidoId,
      p_sector: sector
    });

    if (error) {
      console.error('Error al marcar sector listo:', error.message);
      throw new Error(`Error al marcar el pedido como listo: ${error.message}`);
    }

    return data as string;
  }

  async obtenerPedidoActivoPorCliente(clienteId?: string, mesaId?: string) {
    let query = this.clienteSupabase
      .from('pedidos')
      .select(`
        id,
        mesa_id,
        cliente_id,
        estado,
        importe_total,
        tiempo_estimado,
        created_at,
        cocina_listo,
        bar_listo,
        mesas (
          id,
          numero
        ),
        pedido_items (
          id,
          cantidad,
          precio_unitario,
          productos (
            id,
            nombre,
            tipo,
            tiempo_elaboracion,
            precio,
            fotos,
            descripcion
          )
        )
      `)
      .not('estado', 'in', '("finalizado","pagado")')
      .order('created_at', { ascending: false })
      .limit(1);

    if (mesaId) {
      query = query.eq('mesa_id', mesaId);
    } else if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error al consultar pedido activo del cliente:', error.message);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  }

  /**
   * Pedidos que ve el mozo según su estado:
   * - ['enviado']: pendientes de autorizar (Puntos 13 y 14)
   * - ['confirmado', 'listo']: en preparación por sector y listos para entregar (Punto 15)
   */
  async obtenerPedidosPendientesMozo(estados: string[] = ['enviado']) {
    const { data, error } = await this.clienteSupabase
      .from('pedidos')
      .select(`
        id,
        mesa_id,
        cliente_id,
        estado,
        importe_total,
        tiempo_estimado,
        created_at,
        cocina_listo,
        bar_listo,
        mesas (
          id,
          numero,
          cliente_id
        ),
        pedido_items (
          id,
          cantidad,
          precio_unitario,
          productos (
            id,
            nombre,
            tipo,
            tiempo_elaboracion,
            precio,
            fotos
          )
        )
      `)
      .in('estado', estados)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error al obtener pedidos pendientes para mozo:', error.message);
      throw new Error(`Error al obtener los pedidos pendientes: ${error.message}`);
    }

    return data ?? [];
  }
  
//CHAT ----
async obtenerHistorialChat() {
  const { data, error } = await this.clienteSupabase
    .from('consultas')
    .select('*')
    .order('created_at', { ascending: true }); // Los más viejos primero, los nuevos abajo

  if (error) console.error('Error al traer mensajes:', error.message);
  return data || [];
}

//Guardar un mensaje nuevo (insertamos el nombre del usuario y el texto)
async enviarMensaje(identificador: string, textoMensaje: string) {
  const { error } = await this.clienteSupabase
    .from('consultas')
    .insert([{ identificador: identificador, mensaje: textoMensaje }]); 
    

  if (error) console.error('Error al guardar mensaje:', error.message);
  try {
    await this.clienteSupabase.functions.invoke('enviar-push', {
      body: {
        title: `Nuevo mensaje de: ${identificador}`,
        body: textoMensaje,
       
      }
    });
  } catch (err) {
    console.error('Error al disparar la push:', err);
  }
}

//Suscribirse al tiempo real para recibir mensajes de otros clientes
//Callback como un mensajero que lleva elmsj del servicioo al componente
escucharChat(callback: (nuevoMensaje: any) => void) {
  return this.clienteSupabase
    .channel('sala-chat') // Canal cualquiera
    .on(
      'postgres_changes',
      //Le dice a Supabase que querés reaccionar 
      //a los cambios que ocurran dentro de las tablas de la base de datos.
      { event: 'INSERT', schema: 'public', table: 'consultas' }, // Escucha solo cuando se inserta algo
      (payload) => { //el objeto que te manda Supabase con toda la información de lo que acaba de pasar.
        callback(payload.new); // Ejecuta la función mandando el mensaje nuevo
      }
    )
    .subscribe();
  }

  /**
   * Registra el resultado de una partida de juego en Supabase.
   */
  async guardarResultadoJuego(juego: string, gano: boolean, descuento: number | null) {
    try {
      const { data: { user } } = await this.clienteSupabase.auth.getUser();
      const payload: any = {
        juego,
        gano,
        descuento,
        user_id: user?.id || null,
        created_at: new Date().toISOString()
      };

      const { error } = await this.clienteSupabase
        .from('juegos')
        .insert([payload]);

      if (error) {
        console.warn('Registro de juego en Supabase (tabla opcional):', error.message);
      }
    } catch (e) {
      console.warn('No se pudo registrar resultado del juego en Supabase:', e);
    }
  }

  /* =========================================================
     ENCUESTAS DE SATISFACCIÓN (PUNTO 20)
     ========================================================= */

  /**
   * Guarda una nueva encuesta de satisfacción asociada al cliente y la mesa actual.
   */
  async guardarEncuesta(
    clienteId: string,
    mesaId: string | null,
    respuestas: {
      comida: number;
      atencion: number;
      ambiente: number;
      recomienda: number;
    }
  ) {
    const payload: any = {
      cliente_id: clienteId,
      respuestas
    };

    if (mesaId) {
      payload.mesa_id = mesaId;
    }

    const { data, error } = await this.clienteSupabase
      .from('encuestas')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error al guardar la encuesta:', error.message);
      throw new Error(`No se pudo guardar la encuesta: ${error.message}`);
    }

    return data;
  }

  /**
   * Verifica si el cliente ya completó una encuesta durante su estadía actual.
   */
  async obtenerEncuestaEstadiaActual(
    clienteId: string,
    mesaId?: string | null,
    desdeFecha?: string | null
  ) {
    let query = this.clienteSupabase
      .from('encuestas')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (mesaId) {
      query = query.eq('mesa_id', mesaId);
    }

    if (desdeFecha) {
      query = query.gte('created_at', desdeFecha);
    } else {
      const haceSeisHoras = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', haceSeisHoras);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error al verificar encuesta de la estadía:', error.message);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  }

  /**
   * Obtiene todas las encuestas registradas para alimentar los gráficos estadísticos.
   */
  async obtenerTodasLasEncuestas() {
    const { data, error } = await this.clienteSupabase
      .from('encuestas')
      .select('id, cliente_id, mesa_id, respuestas, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error al obtener las encuestas:', error.message);
      throw new Error(`Error al cargar resultados de encuestas: ${error.message}`);
    }

    return data ?? [];
  }
}



