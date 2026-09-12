import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'inicio',
    loadComponent: () => import('./paginas/inicio/inicio.component').then((m) => m.InicioComponent),
  },
  {
    path: '',
    redirectTo: 'inicio',
    pathMatch: 'full',
  },
  {
    path: 'registro',
    loadComponent: () => import('./paginas/registro/registro.page').then( m => m.RegistroPage)
    loadComponent: () => import('./paginas/registro/registro.page').then((m) => m.RegistroPage),
  },
  {
    path: 'login',
    loadComponent: () => import('./paginas/login/login.page').then( m => m.LoginPage)
    loadComponent: () => import('./paginas/login/login.page').then((m) => m.LoginPage),
  },
   {
  {
    path: 'accesoRapido',
    loadComponent: () => import('./paginas/acceso-rapido/acceso-rapido.component').then( m => m.AccesoRapidoComponent)
    loadComponent: () => import('./paginas/acceso-rapido/acceso-rapido.component').then((m) => m.AccesoRapidoComponent),
  },
  {
    path: 'alta-plato',
    loadComponent: () => import('./paginas/alta-plato/alta-plato.page').then( m => m.AltaPlatoPage)
    loadComponent: () => import('./paginas/alta-plato/alta-plato.page').then( m => m.AltaPlatoPage)
    loadComponent: () => import('./paginas/alta-plato/alta-plato.page').then((m) => m.AltaPlatoPage),



  {
    path: 'alta-empleado',
    loadComponent: () => import('./paginas/alta-empleado/alta-empleado.page').then((m) => m.AltaEmpleadoPage),
  },
