declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    const destino = payload.destino || payload.to || payload.record?.correo;
    const tipo = payload.tipo || payload.category || payload.record?.estado;
    const nombreCliente = payload.nombreCliente || payload.record?.nombres || "Usuario";
    const subject = payload.subject || payload.title || `Novedades sobre tu cuenta en Basílico (${tipo})`;
    const cuerpoMensaje = payload.mensaje || payload.messageHtml || payload.html || `Tu solicitud ha actualizado a estado: <strong>${tipo}</strong>.`;

    if (!destino) {
      return new Response(
        JSON.stringify({ error: "Falta el correo de destino" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromMap: Record<string, string> = {
      notificaciones: "Basílico Registro <notificaciones@restobasilico.com.ar>",
      factura: "Basílico Facturación <tufactura@restobasilico.com.ar>",
      reservas: "Basílico Reservas <reservas@restobasilico.com.ar>",
      delivery: "Basílico Delivery <delivery@restobasilico.com.ar>",
      pendiente: "Basílico Registro <notificaciones@restobasilico.com.ar>",
      aprobado: "Basílico Registro <notificaciones@restobasilico.com.ar>",
      rechazado: "Basílico Registro <notificaciones@restobasilico.com.ar>"
    };

    const from = fromMap[tipo] || "Basílico Notificaciones <notificaciones@restobasilico.com.ar>";

    const colorTitulo = tipo === "rechazado" ? "#b24d39" : "#283720";

    // Plantilla visual con la identidad de marca de Basílico
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e0e0e0; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        
        <!-- Banner Superior con Logo Completo (Olive #283720) -->
        <div style="background-color: #283720; padding: 24px 20px; text-align: center;">
          <img src="https://xmlcpvfjlnuakqehrvom.supabase.co/storage/v1/object/public/assets/Basiloco_beige.png" alt="Basílico" style="max-width: 170px; width: 170px; height: auto; display: block; margin: 0 auto;" />
          <p style="color: #ede5d2; margin: 8px 0 0 0; font-size: 13px; opacity: 0.85; letter-spacing: 0.5px;">Sabores de Italia cerca tuyo</p>
        </div>

        <!-- Contenido Central -->
        <div style="padding: 26px 22px; color: #333333;">
          <h2 style="color: ${colorTitulo}; margin-top: 0; font-size: 20px;">${subject}</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #444444; margin: 0 0 16px 0;">
            Hola <strong>${nombreCliente}</strong>,
          </p>
          <div style="font-size: 15px; line-height: 1.6; color: #333333; margin: 16px 0;">
            ${cuerpoMensaje}
          </div>
        </div>

        <!-- Footer Institucional -->
        <div style="background-color: #83967d; padding: 14px 20px; text-align: center; color: #ffffff; font-size: 11px; line-height: 1.4;">
          <p style="margin: 0; opacity: 0.95;">Este es un correo automático emitido por el sistema de gestión de Basílico.</p>
        </div>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from, to: [destino], subject, html }),
    });

    const resData = await resendRes.json();

    return new Response(
      JSON.stringify(resData),
      { status: resendRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});