import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Plato } from '../interfaces/plato';

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

    console.log('Datos guardados:', data);
    return data;
  }

  async guardarDatosClientes(
    apellidos: string,
    nombres: string,
    dni: number,
    correo: string,
    clave: string,
    foto_url: string
  ) {
    const { data, error } = await this.clienteSupabase
      .from('clientes')
      .insert([{
        apellidos,
        nombres,
        dni,
        correo,
        clave,
        estado: 'pendiente',
        foto_url
      }]);

    if (error) {
      console.error('Error al guardar cliente:', error.message);
      throw new Error(error.message);
    }

    return data;
  }

  async guardarMesa(numero: number, cantidadComensales: number, tipo: string, disponibilidad: string, fotoUrl: string) {
    const { data, error } = await this.clienteSupabase
      .from('mesas')
      .insert([
        {
          numero,
          cantidad_comensales: cantidadComensales,
          tipo,
          disponibilidad,
          foto_url: fotoUrl,
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
          OBTIENE PLATOS desde supabase
  =======================================*/
  async obtenerPlatos(): Promise<Plato[]> {

    const { data, error } = await this.clienteSupabase
      .from('productos')
      .select('*')
      .eq('tipo', 'plato')
      .order('nombre', {
        ascending: true
      });

    if (error) {
      throw Error(
        `Error al obtener los platos: ${error.message}`
      );
    }

    return (data ?? []) as Plato[];
  }


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

  async obtenerClientesPendientes() {
    const { data, error } = await this.clienteSupabase
      .from('clientes')
      .select('*')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error al obtener clientes pendientes: ${error.message}`);
    }

    return data ?? [];
  }

  async cambiarEstadoCliente(id: string | number, estado: 'aprobado' | 'rechazado') {
    const { data, error } = await this.clienteSupabase
      .from('clientes')
      .update({ estado })
      .eq('id', id)
      .select();

    if (error) {
      throw new Error(`Error al actualizar estado del cliente: ${error.message}`);
    }

    return data;
  }

}
