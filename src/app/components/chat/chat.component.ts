import { Component, OnInit, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonInput, IonButton, IonIcon, IonBackButton, IonButtons 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { send, chatbubblesOutline, removeOutline } from 'ionicons/icons';
import { Supabase } from '../../services/supabase';
import { NavController } from '@ionic/angular';
import { ChatEstadoService } from '../../services/chat-servicio';
import { PushNotificationsService } from '../../services/push-notifications.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonInput, 
    IonButton, IonIcon, IonBackButton, IonButtons 
  ]
})
export class ChatComponent implements OnInit, OnDestroy {

  abierto = signal<boolean>(false);
  mensajes = signal<any[]>([]); 
  nuevoMensaje = '';
  identif = signal<string>(""); 

  @ViewChild('contenedorMensajes') private contenedorMensajes!: ElementRef;
  private suscripcionChat: any;

  constructor(
    private supabase: Supabase, 
    private chatEstado: ChatEstadoService, 
    private pushNotificationsService: PushNotificationsService
  ) {
    addIcons({ send, chatbubblesOutline, removeOutline });
  }

  async ngOnInit() {
    const historial = await this.supabase.obtenerHistorialChat();
    const identificador = localStorage.getItem('identificador'); 
    this.identif.set(identificador || 'Anónimo');
    this.mensajes.set(historial);
    this.abierto.set(true);

    await this.pushNotificationsService.inicializar();
    this.chatEstado.resetearNoLeidos();

    this.scrollToBottom();
    
    this.suscripcionChat = this.supabase.escucharChat((nuevoMsg) => {
      this.mensajes.update((lista) => [...lista, nuevoMsg]);

      if (!this.abierto() && nuevoMsg.identificador !== this.identif()) {
        this.chatEstado.incrementarNoLeidos();
      }

      
      this.scrollToBottom();
    });
  }
  
  cerrar() {
    this.abierto.set(false);
  }

  async mandar() {
    if (!this.nuevoMensaje.trim()) return; 

    const texto = this.nuevoMensaje;
    const remitente = this.identif(); 
    this.nuevoMensaje = ''; 
    await this.supabase.enviarMensaje(remitente, texto);

    
    this.scrollToBottom();
    try {
      await this.pushNotificationsService.enviarNotificacion(
        `Nuevo mensaje de: ${remitente}`,
        texto,
        { 
          userIds: ['ID_DEL_DESTINATARIO_O_ROL'] 
        },
        { ruta: '/chat' }
      );
    } catch (error) {
      console.error('Error al enviar la push del chat:', error);
    }
  }

  // Función auxiliar para forzar el scroll hacia abajo
  scrollToBottom() {
    setTimeout(() => {
      try {
        if (this.contenedorMensajes) {
          const elemento = this.contenedorMensajes.nativeElement;
          elemento.scrollTop = elemento.scrollHeight;
        }
      } catch (err) {
        console.error('Error al hacer scroll:', err);
      }
    }, 150);
  }

  ngOnDestroy() {
    if (this.suscripcionChat) {
      this.suscripcionChat.unsubscribe();
    }
  }
}