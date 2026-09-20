import { ESTILOS_EMAIL_APROBADO, ESTILOS_EMAIL_RECHAZADO } from "./estilos-email";

export interface DatosClienteEmail {
  nombres: string;
  apellidos: string;
  dni?: number | string;
  correo?: string;
}

// Logo oficial completo (marca tipográfica) en tono beige/crema alojado en el bucket público 'assets'
export const LOGO_BASILICO_COMPLETO = "https://xmlcpvfjlnuakqehrvom.supabase.co/storage/v1/object/public/assets/Basiloco_beige.png";

/**
 * Plantilla HTML de Aprobación de Cliente (Punto 8)
 * Fondo Verde Oliva Basílico (#283720), tipografía Segoe UI/Arial.
 */
export function generarHtmlAprobacion(cliente: DatosClienteEmail): string {
  return `
    <style>${ESTILOS_EMAIL_APROBADO}</style>

    <div class="contenedor-verde" style="background-color: #283720; border-radius: 12px; padding: 22px 18px; text-align: center; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">
      <span class="badge-verde" style="display: inline-block; background-color: #83967d; color: #ffffff; font-size: 11px; font-weight: 700; padding: 5px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
        Registro Aprobado
      </span>

      <h2 class="titulo-verde" style="font-size: 21px; font-weight: 700; color: #ede5d2; margin: 0 0 6px 0; letter-spacing: 1px;">
        ¡Cuenta Habilitada!
      </h2>

      <div class="tarjeta-blanca-verde" style="background-color: #f9f7f2; border-radius: 10px; padding: 18px 16px; color: #283720; text-align: left; margin: 16px 0; border-left: 5px solid #283720;">
        <p class="texto-parrafo" style="font-size: 14px; line-height: 1.6; color: #2d3b27; margin: 0 0 10px 0;">
          ¡Excelente noticia! Tu solicitud de registro fue revisada y <strong>aprobada por la administración de Basílico</strong>.
        </p>
        <p class="texto-parrafo" style="font-size: 14px; line-height: 1.6; color: #2d3b27; margin: 0 0 12px 0;">
          A partir de este momento podés ingresar a la aplicación móvil con tu correo electrónico y contraseña para descubrir la carta, solicitar atención y gestionar tus pedidos.
        </p>

        <div style="background-color: #eae5d8; border-radius: 8px; padding: 12px 14px; margin-top: 10px;">
          ${cliente.dni ? `<p class="fila-dato-verde" style="font-size: 13px; color: #283720; margin: 4px 0;"><strong>DNI registrado:</strong> ${cliente.dni}</p>` : ''}
          <p class="fila-dato-verde" style="font-size: 13px; color: #283720; margin: 4px 0;"><strong>Estado:</strong> Habilitado</p>
        </div>
      </div>

      <p class="pie-verde" style="font-size: 12px; color: #ede5d2; margin: 12px 0 0 0; text-align: center; opacity: 0.9;">
        Te esperamos en el restaurante Basílico para disfrutar de la mejor experiencia gastronómica.
      </p>
    </div>
  `;
}

/**
 * Plantilla HTML de Rechazo de Cliente (Punto 7)
 * Fondo Terracota Basílico (#b24d39), tipografía Georgia/serif.
 */
export function generarHtmlRechazo(cliente: DatosClienteEmail): string {
  return `
    <style>${ESTILOS_EMAIL_RECHAZADO}</style>

    <div class="contenedor-rojo" style="background-color: #b24d39; border-radius: 12px; padding: 22px 18px; text-align: center; color: #ffffff; font-family: Georgia, 'Times New Roman', serif;">
      <span class="badge-rojo" style="display: inline-block; background-color: #7a2818; color: #ffffff; font-size: 11px; font-weight: 700; padding: 5px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
        Solicitud No Admitida
      </span>

      <h2 class="titulo-rojo" style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 6px 0; letter-spacing: 1.5px;">
        Solicitud Desestimada
      </h2>

      <div class="tarjeta-blanca-rojo" style="background-color: #fdf9f7; border-radius: 10px; padding: 18px 16px; color: #3b1710; text-align: left; margin: 16px 0; border-left: 5px solid #b24d39;">
        <p class="texto-parrafo-rojo" style="font-size: 14px; line-height: 1.6; color: #4a2119; margin: 0 0 10px 0;">
          Te informamos que, tras la evaluación de la administración de Basílico, tu solicitud de registro <strong>no ha sido admitida</strong> en esta ocasión.
        </p>
        <p class="texto-parrafo-rojo" style="font-size: 14px; line-height: 1.6; color: #4a2119; margin: 0 0 12px 0;">
          Si considerás que ocurrió un error involuntario en tus datos o deseás consultar el motivo de esta resolución, podés comunicarte directamente con la administración del restaurante.
        </p>

        <div style="background-color: #f5e4df; border-radius: 8px; padding: 12px 14px; margin-top: 10px;">
          ${cliente.dni ? `<p class="fila-dato-rojo" style="font-size: 13px; color: #8c3220; margin: 4px 0;"><strong>DNI consultado:</strong> ${cliente.dni}</p>` : ''}
          <p class="fila-dato-rojo" style="font-size: 13px; color: #8c3220; margin: 4px 0;"><strong>Estado:</strong> No admitido</p>
        </div>
      </div>

      <p class="pie-rojo" style="font-size: 12px; color: #fde8e3; margin: 12px 0 0 0; text-align: center; opacity: 0.9;">
        Atentamente, Dirección y Administración de Basílico.
      </p>
    </div>
  `;
}

/**
 * Plantilla HTML de Confirmación de Registro en Revisión (Punto 5)
 * Aviso formal de recepción de solicitud.
 */
export function generarHtmlConfirmacion(cliente: DatosClienteEmail): string {
  return `
    <div style="background-color: #f5f0e6; border-radius: 12px; padding: 22px 18px; text-align: center; color: #283720; font-family: 'Segoe UI', Arial, sans-serif; border: 2px solid #83967d;">
      <span style="display: inline-block; background-color: #83967d; color: #ffffff; font-size: 11px; font-weight: 700; padding: 5px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
        Solicitud en Revisión
      </span>

      <h2 style="font-size: 20px; font-weight: 700; color: #283720; margin: 0 0 10px 0;">
        Solicitud Recibida
      </h2>

      <div style="background-color: #ffffff; border-radius: 10px; padding: 16px; color: #283720; text-align: left; margin: 14px 0; border-left: 5px solid #83967d;">
        <p style="font-size: 14px; line-height: 1.6; color: #2d3b27; margin: 0 0 10px 0;">
          Tu solicitud de registro ha sido recibida correctamente en nuestro sistema y se encuentra en proceso de revisión por parte de la administración.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #2d3b27; margin: 0;">
          Te notificaremos automáticamente por este medio en cuanto tu cuenta sea evaluada para que puedas ingresar a la aplicación.
        </p>
      </div>

      <p style="font-size: 13px; font-weight: 600; color: #283720; margin: 14px 0 0 0; text-align: center;">
        Gracias por registrarte en Basílico.
      </p>
    </div>
  `;
}
