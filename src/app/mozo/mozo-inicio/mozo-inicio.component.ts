import { Component, OnInit } from '@angular/core';
import { 
  IonContent, IonGrid, IonRow, IonCol, IonIcon,
  IonList, IonItem, IonInput, IonButton, IonHeader,
  IonText, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonToolbar, IonTitle, IonButtons, IonBackButton
} from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { addIcons } from 'ionicons';
import { signal } from '@angular/core';
import {ChatComponent} from '../../components/chat/chat.component';
import { listOutline, receiptOutline, checkmarkDoneOutline, chatbubblesOutline } from 'ionicons/icons';
import { ChatEstadoService } from '../../services/chat-servicio';
@Component({
  selector: 'app-mozo-inicio',
  templateUrl: './mozo-inicio.component.html',
  styleUrls: ['./mozo-inicio.component.scss'],
  imports: [ChatComponent, IonContent, IonCard,  IonIcon, IonHeader, IonCardHeader, IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonButton, RouterLink, NavbarComponent, IonList, IonItem, IonInput, IonText,
      IonToolbar, IonTitle, IonButtons, IonBackButton],
})
export class MozoInicioComponent  implements OnInit {
  abrirChatModal = signal<boolean>(false);

  readonly chatsNoLeidos = this.chatEstado.chatsNoLeidos;
  constructor(private chatEstado: ChatEstadoService) { 
    addIcons({ listOutline, receiptOutline, checkmarkDoneOutline, chatbubblesOutline });
  }

  ngOnInit() {
    this.cargarNombreChat();
  }


  alternarChat() {
  this.abrirChatModal.set(!this.abrirChatModal());  
  } 

  cargarNombreChat(){
    const nombre = localStorage.getItem('nombre') || 'Mozo Anónimo';
    const identificador = "Mozo " + nombre;
    localStorage.setItem('identificador', identificador);
  }
}
