import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonInput, IonButton, IonIcon 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { send, chatbubblesOutline, removeOutline } from 'ionicons/icons';
import { Supabase } from '../../services/supabase';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonInput, 
    IonButton, IonIcon
  ]
})
export class ChatComponent implements OnInit, OnDestroy {

  abierto = signal<boolean>(false);
  mensajes = signal<any[]>([]); 
  nuevoMensaje = '';
  
  identificador = localStorage.getItem('identificador') || 'Jugador Anónimo'; 
  private suscripcionChat: any;

  constructor(private supabase: Supabase) {
    addIcons({ send, chatbubblesOutline, removeOutline });
  }

  async ngOnInit() {
    const historial = await this.supabase.obtenerHistorialChat();
    this.mensajes.set(historial);

    this.suscripcionChat = this.supabase.escucharChat((nuevoMsg) => {
      this.mensajes.update((lista) => [...lista, nuevoMsg]);
    });
  }

  toggleChat() {
    this.abierto.update(val => !val);
  }

  async mandar() {
    if (!this.nuevoMensaje.trim()) return; 

    const texto = this.nuevoMensaje;
    this.nuevoMensaje = ''; 

    await this.supabase.enviarMensaje(this.identificador, texto);
  }

  ngOnDestroy() {
    if (this.suscripcionChat) {
      this.suscripcionChat.unsubscribe();
    }
  }
}