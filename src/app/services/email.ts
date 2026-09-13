import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { Supabase } from './supabase';

export type SenderCategory = 'notificaciones' | 'factura' | 'reservas' | 'delivery';

export interface EmailOptions {
    to: string | string[];
    subject: string;
    category: SenderCategory;
    title: string;
    messageHtml: string;
}

@Injectable({
    providedIn: 'root'
})
export class EmailService {
    constructor(private supabase: Supabase) { }

    sendEmail(options: EmailOptions): Observable<any> {
        return from(
            this.supabase.clienteSupabase.functions.invoke('enviar-correo', {
                body: {
                    to: options.to,
                    category: options.category,
                    title: options.title,
                    subject: options.subject,
                    messageHtml: options.messageHtml
                }
            }).then(({ data, error }) => {
                // Si Supabase devuelve error de red o la Edge Function devuelve un objeto de error
                if (error) throw new Error(error.message);
                if (data && data.error) throw new Error(data.error);
                return data;
            })
        );
    }
}