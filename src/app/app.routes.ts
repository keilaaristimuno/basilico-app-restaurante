import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "inicio",
    loadComponent: () => import("./paginas/inicio/inicio.component").then((m) => m.InicioComponent),
  },
  {
    path: "",
    redirectTo: "inicio",
    pathMatch: "full",
  },
  {
    path: "registro",
    loadComponent: () => import("./paginas/registro/registro.page").then((m) => m.RegistroPage),
  },
  {
    path: "login",
    loadComponent: () => import("./paginas/login/login.page").then((m) => m.LoginPage),
  },
  {
    path: "accesoRapido",
    loadComponent: () => import("./paginas/acceso-rapido/acceso-rapido.component").then((m) => m.AccesoRapidoComponent),
  },
  {
    path: "alta-plato",
    loadComponent: () => import("./paginas/alta-plato/alta-plato.page").then((m) => m.AltaPlatoPage),
  },
  {
    path: "alta-empleado",
    loadComponent: () => import("./paginas/alta-empleado/alta-empleado.page").then((m) => m.AltaEmpleadoPage),
  },
  {
    path: "alta-mesa",
    loadComponent: () => import("./paginas/alta-mesa/alta-mesa.page").then((m) => m.AltaMesaPage),
  },
  {
    path: 'metreInicio',
    loadComponent: () => import('./metre/metre-inicio/metre-inicio.component').then(m => m.MetreInicioComponent)
  },
  {
    path: 'qrIngreso',
    loadComponent: () => import('./paginas/qr-ingreso/qr-ingreso.component').then( m => m.QrIngresoComponent)
  },
   {
    path: 'clienteInicio',
    loadComponent: () => import('./cliente-inicio/cliente-inicio.component').then( m => m.ClienteInicioComponent)
  },
  {
    path: 'admin-email',
    loadComponent: () => import('./paginas/admin-email/admin-email.page').then(m => m.AdminEmailPage)
  },
  {
    path: 'carta',
    loadComponent: () => import('./paginas/carta/carta.page').then( m => m.CartaPage)
  },
  {
    path: 'clientes-pendientes',
    loadComponent: () => import('./paginas/clientes-pendientes/clientes-pendientes.page').then(m => m.ClientesPendientesPage)
  },
  {
    path: '**',
    redirectTo: 'inicio'
  }
];
