import { Component, Input, OnInit } from '@angular/core';
import { IonTabBar, IonTabButton, IonLabel} from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { Supabase } from '../../services/supabase';

@Component({
  selector: 'app-navbar',
  standalone: true,
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  imports: [RouterLink, IonTabBar, IonTabButton,IonLabel],
})
export class NavbarComponent implements OnInit {

  @Input() rutaInicio: string = '/';

  nombre: string | null = null;
  constructor(
    private supabase: Supabase, 
    private router: Router) { }
  
  ngOnInit(){
    this.nombre = localStorage.getItem('nombre')?.toUpperCase() || null;
  }

  /* Cerrar sesion  */
  async cerrarSesion() {
    const { error } = await this.supabase.cerrarSesion();

    if (error) {
      console.error('Error al cerrar sesión:', error.message);
      return;
    }
    localStorage.removeItem('nombre');
    localStorage.removeItem('perfil');

    await this.router.navigate(['/login'], {
      replaceUrl: true
    });

  }
}
