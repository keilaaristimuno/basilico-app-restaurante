import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
  async obtenerPerfilUsuarioLogueado() {
    const { data: { user } } = await this.clienteSupabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await this.clienteSupabase
      .from('perfiles_completos')
      .select('nombres, perfil, tipo')
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

}