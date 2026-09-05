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
  guardarDatosEmpleados(apellidos: string, nombres: string, dni:number, cuil:number, correo:string, clave:string, perfil:string, foto_url:string){
    this.clienteSupabase.from('empleados').insert([ //'empleados hace rerencia a la bla que cree en SB'
      {apellidos:apellidos, nombres: nombres, dni:dni, cuil: cuil, correo:correo, clave:clave, perfil:perfil, foto_url:foto_url}
    ]).then(({ data, error }) => {
      if(error){
        console.error('Error: ',error.message);
      }else{
        //this.router.navigate(['/bienvenido']);
      }
      console.log('Datos guardados:', data);
    });

  }

}
