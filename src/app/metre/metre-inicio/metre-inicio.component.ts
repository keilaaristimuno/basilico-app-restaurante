import { Component, OnInit } from '@angular/core';
import { 
  IonContent, IonGrid, IonRow, IonCol, 
  IonList, IonModal, IonItem, IonInput, IonButton, IonHeader,
  IonText, IonCard, IonLabel, IonCardHeader, IonCardTitle, IonCardContent, IonToolbar, IonTitle, IonButtons, IonBackButton
} from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { Supabase } from '../../services/supabase';
import { WritableSignal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PushNotificationsService } from '../../services/push-notifications.service';


@Component({
  selector: 'app-metre-inicio',
  standalone: true,
  templateUrl: './metre-inicio.component.html',
  styleUrls: ['./metre-inicio.component.scss'],
  imports: [IonContent, IonCard, IonHeader, IonCardHeader, IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonButton, RouterLink, NavbarComponent, IonList, IonItem, IonInput, IonText,
    IonToolbar, IonTitle, IonButtons, IonBackButton, IonModal, IonLabel, CommonModule]
})
export class MetreInicioComponent  {

  listaEspera = signal<any[]>([]);
  listaMesas = signal<any[]>([]);
  mostrarMesas = signal<boolean>(false);
  idSeleccionadoCliente = signal<string>('');

  constructor( private supabase: Supabase, private pushNotificationsService: PushNotificationsService) { }

  ngOnInit() {
    this.obtenerListaEspera();
  }

  async obtenerListaEspera() {
    try {
      const lista = await this.supabase.obtenerListaDeEspera();
      this.listaEspera.set(lista);
    }
    catch (error) {
      console.error('Error al obtener la lista de espera:', error);
    }
  }

  async rechazarCliente(idCliente:string){
    try{
      await this.supabase.eliminarDeListaDeEspera(idCliente)
      await this.pushNotificationsService.enviarNotificacion(
        '¡Solicitud rechazada!',
        `El metre te ha rechazado su solicitud de mesa.`,
        { userIds: [idCliente] }, // Destinatario específico
        { ruta: '/inicio' }  // Redirige al inicio
      );
    } catch(error){
      console.log('error ', error)
    }
    
  }

  async asignarMesaCliente(idCliente: string, numeroMesa: string){
    try {
      await this.supabase.asignarMesaACliente(idCliente, numeroMesa);
      
      await this.pushNotificationsService.enviarNotificacion(
        '¡Mesa Asignada!',
        `El metre te ha asignado la Mesa N° ${numeroMesa}. Ya puedes escanear el código QR correspondiente.`,
        { userIds: [idCliente] }, // Destinatario específico
        { ruta: '/escanear-qr' }  // Ruta a la que viajará cuando el cliente haga tap en la notificación
      );

      console.log('Notificación push enviada al cliente');

    } catch (error) {
      console.error('Error durante la asignación o envío de push:', error);
    }

      await this.obtenerListaEspera(); // Refrescar lista de espera
      //alert(`Mesa N° ${numeroMesa} asignada correctamente.`);
   
  }
  

  async abrirModuleMesas(id:string){
    this.idSeleccionadoCliente.set(id);  
    try {
      const mesas = await this.supabase.obtenerMesas();
      this.listaMesas.set(mesas || []);
    } catch (error) {
      console.error('Error al obtener las mesas:', error);
    }

    this.mostrarMesas.set(true);

  }

  cerrarModalMesas(){
    this.mostrarMesas.set(false);
  }


  

}
