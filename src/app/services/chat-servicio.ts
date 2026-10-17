import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ChatEstadoService {

  chatsNoLeidos = signal<number>(0);

  incrementarNoLeidos() {
    this.chatsNoLeidos.update(val => val + 1);
  }


  resetearNoLeidos() {
    this.chatsNoLeidos.set(0);
  }
}
