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
      .eq('id', id);
  }

  //para asignar una mesa a un cliente en la lista de espera
  async asignarMesaACliente(clienteId: string, numeroMesa: string) {
    
    const { error: errorMesa } = await this.clienteSupabase
      .from('mesas')
      .update({
        disponibilidad: 'ocupada',
        cliente_id: clienteId
      })
      .eq('numero', numeroMesa);

    if (errorMesa) throw errorMesa;

    // eliminar cliente de lista de espera 
    this.eliminarDeListaDeEspera(clienteId);
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

  async obtenerPedidosPendientesMozo() {
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
      .eq('estado', 'enviado')
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
}

