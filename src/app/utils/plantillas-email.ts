import { ESTILOS_EMAIL_APROBADO, ESTILOS_EMAIL_RECHAZADO } from "./estilos-email";

export interface DatosClienteEmail {
  nombres: string;
  apellidos: string;
  dni: number | string;
  correo?: string;
}

export function generarHtmlAprobacion(cliente: DatosClienteEmail): string {
  return `
    <style>${ESTILOS_EMAIL_APROBADO}</style>

    <div class="email-aprobado-card">
      <div class="email-header">
        <h1 class="logo-titulo">BASILICO</h1>
        <p class="logo-bajada">Ristorante & Cucina d'Autore</p>
      </div>

      <div class="cuerpo-email">
        <span class="badge-exito">Registro Aprobado</span>
        <h2 class="saludo-cliente">Felicitaciones, ${cliente.nombres}!</h2>
        <p class="texto-destacado">
          Nos complace informarte que tu solicitud de registro ha sido <strong>revisada y aprobada</strong> por la administracion de Basilico.
        </p>

        <div class="tarjeta-datos">
          <p class="fila-dato"><strong>Cliente:</strong> ${cliente.apellidos}, ${cliente.nombres}</p>
          <p class="fila-dato"><strong>DNI:</strong> ${cliente.dni}</p>
          <p class="fila-dato"><strong>Estado de cuenta:</strong> <span class="estado-activo">Activa / Aprobada</span></p>
        </div>

        <p class="texto-destacado">
          Ya podes ingresar a la aplicacion movil con tu correo electronico y contrasena para acceder a la carta, gestionar reservas y disfrutar de nuestra experiencia gastronomica.
        </p>
      </div>

      <div class="email-footer">
        <p style="margin: 0;">Gracias por elegir <strong>Basilico</strong>.</p>
        <p style="margin: 4px 0 0 0;">Mensaje automatico emitido por el sistema de gestion.</p>
      </div>
    </div>
  `;
}

export function generarHtmlRechazo(cliente: DatosClienteEmail): string {
  return `
    <style>${ESTILOS_EMAIL_RECHAZADO}</style>

    <div class="email-rechazado-card">
      <div class="email-header-rechazo">
        <h1 class="logo-titulo-rechazo">BASILICO</h1>
        <p class="logo-bajada-rechazo">Gestion de Registros</p>
      </div>

      <div class="cuerpo-email-rechazo">
        <span class="badge-rechazo">Solicitud Desestimada</span>
        <h2 class="saludo-rechazo">Estimado/a ${cliente.nombres} ${cliente.apellidos},</h2>
        <p class="texto-rechazo">
          Le informamos que su solicitud de registro para acceder a nuestra aplicacion ha sido <strong>revisada y rechazada</strong> por el equipo de supervision.
        </p>

        <div class="tarjeta-datos-rechazo">
          <p class="fila-dato-rechazo"><strong>Solicitante:</strong> ${cliente.apellidos}, ${cliente.nombres}</p>
          <p class="fila-dato-rechazo"><strong>DNI:</strong> ${cliente.dni}</p>
          <p class="fila-dato-rechazo"><strong>Estado:</strong> <span class="estado-inactivo">Rechazado</span></p>
        </div>

        <p class="texto-rechazo">
          Si considera que se trata de un error involuntario o desea obtener mas informacion sobre el motivo de esta decision, por favor comuniquese directamente con la administracion del restaurante.
        </p>
      </div>

      <div class="email-footer-rechazo">
        <p style="margin: 0;">Atentamente, Administracion de <strong>Basilico</strong>.</p>
        <p style="margin: 4px 0 0 0;">Mensaje generado automaticamente. Por favor no responder a esta casilla.</p>
      </div>
    </div>
  `;
}
