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
    path: 'inicio-cocinero',
    loadComponent: () => import('./paginas/cocinero/inicio-cocinero/inicio-cocinero.page').then( m => m.InicioCocineroPage)
  },
  {
    path: 'pedidos-cocina',
    loadComponent: () => import('./paginas/cocinero/pedidos-cocina/pedidos-cocina.page').then(m => m.PedidosCocinaPage)
  },
  {
    path: 'mozoInicio',
    loadComponent: () => import('./mozo/mozo-inicio/mozo-inicio.component').then( m => m.MozoInicioComponent)
  },
  {
    path: 'duenioInicio',
    loadComponent: () => import('./paginas/inicio-duenio/inicio-duenio.component').then( m => m.InicioDuenioComponent)
  },
  {
    path: 'juegos',
    loadComponent: () => import('./paginas/juegos/juegos.page').then(m => m.JuegosPage)
  },
  {
    path: 'registroAnonimo',
    loadComponent: () => import('./paginas/registro-anonimo/registro-anonimo.component').then(m => m.RegistroAnonimoComponent)
  },
  {
    path: 'alta-bebida',
    loadComponent: () => import('./paginas/alta-bebida/alta-bebida.page').then( m => m.AltaBebidaPage)
  },
  {
    path: 'inicio-cantinero',
    loadComponent: () => import('./paginas/inicio-cantinero/inicio-cantinero.page').then( m => m.InicioCantineroPage)
  },
  {
    path: 'listaEspera',
    loadComponent: () => import('./metre/lista-espera/lista-espera.component').then( m => m.ListaEsperaComponent)
  },
  {
    path: 'pedidos-bar',
    loadComponent: () => import('./paginas/cantinero/pedidos-bar/pedidos-bar.page').then(m => m.PedidosBarPage)
  },
  {
    path: 'chat',
    loadComponent: () => import('./components/chat/chat.component').then(m => m.ChatComponent)
  },
  {
    path: 'pedidosMozo',
    loadComponent: () => import('./mozo/pedidos/pedidos.component').then(m => m.PedidosComponent)
  },
  {
    path: '**',
    redirectTo: 'inicio'
  }
  
];
