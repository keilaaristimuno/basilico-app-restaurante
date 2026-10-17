import { createClient } from "@supabase/supabase-js";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json"
};

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  userIds?: string[];
  profiles?: string[];
};

type FirebaseServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function base64UrlEncode(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function createGoogleAccessToken(account: FirebaseServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64UrlEncode(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsignedToken = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );
  const assertion = `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const result = await response.json();
  if (!response.ok) throw new Error(`No se pudo autenticar con Firebase: ${JSON.stringify(result)}`);
  return result.access_token;
}

async function getTargetTokens(
  supabaseAdmin: any,
  payload: PushPayload
): Promise<string[]> {
  let query = supabaseAdmin
    .from("device_tokens")
    .select("token")
    .eq("activo", true);

  if (payload.userIds?.length) {
    const validIds = payload.userIds.filter(Boolean);
    if (!validIds.length) return [];

    // Si los userIds provienen de la tabla 'clientes', resolvemos sus correos para encontrar su Auth UID
    const { data: clientesResp } = await supabaseAdmin
      .from("clientes")
      .select("correo")
      .in("id", validIds);

    // Si provienen de la tabla 'empleados'
    const { data: empleadosResp } = await supabaseAdmin
      .from("empleados")
      .select("correo")
      .in("id", validIds);

    const targetEmails: string[] = [];
    ((clientesResp as any[]) ?? []).forEach((cli: any) => {
      if (cli?.correo) targetEmails.push(cli.correo.toLowerCase());
    });
    ((empleadosResp as any[]) ?? []).forEach((emp: any) => {
      if (emp?.correo) targetEmails.push(emp.correo.toLowerCase());
    });

    let authIds: string[] = [];
    if (targetEmails.length) {
      const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });
      if (!usersError && users?.users?.length) {
        const emailSet = new Set(targetEmails);
        authIds = users.users
          .filter((u: any) => u.email && emailSet.has(u.email.toLowerCase()))
          .map((u: any) => u.id);
      }
    }

    const candidateIds = [...new Set([...validIds, ...authIds])];
    query = query.in("user_id", candidateIds);
  } else if (payload.profiles?.length) {
    const employeeProfiles = payload.profiles.filter((p) => p !== "cliente");
    const targetEmails: string[] = [];

    if (employeeProfiles.length) {
      const { data: empleadosResp, error } = await supabaseAdmin
        .from("empleados")
        .select("correo")
        .in("perfil", employeeProfiles);
      if (error) throw error;
      ((empleadosResp as any[]) ?? []).forEach((emp: any) => {
        if (emp?.correo) targetEmails.push(emp.correo.toLowerCase());
      });
    }

    if (payload.profiles.includes("cliente")) {
      const { data: clientesResp, error } = await supabaseAdmin
        .from("clientes")
        .select("correo")
        .eq("estado", "aprobado");
      if (error) throw error;
      ((clientesResp as any[]) ?? []).forEach((cli: any) => {
        if (cli?.correo) targetEmails.push(cli.correo.toLowerCase());
      });
    }

    if (!targetEmails.length) return [];

    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    if (usersError) throw usersError;

    const emailSet = new Set(targetEmails);
    const ids = (users.users ?? [])
      .filter((user: any) => user.email && emailSet.has(user.email.toLowerCase()))
      .map((user: any) => user.id);
    if (!ids.length) return [];
    query = query.in("user_id", ids);
  } else {
    throw new Error("Debe indicar userIds o profiles como destinatarios");
  }

  const { data, error } = await query;
  if (error) throw error;
  return [...new Set(((data as any[]) ?? []).map((row: any) => row.token).filter(Boolean))];
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Se requiere autenticación" }, 401);
    }

    const payload = await request.json() as PushPayload;
    if (!payload.title?.trim() || !payload.body?.trim()) {
      return jsonResponse({ error: "title y body son obligatorios" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const accountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!supabaseUrl || !serviceRoleKey || !accountJson) {
      return jsonResponse({ error: "Faltan secretos de Supabase o Firebase" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const account = JSON.parse(accountJson) as FirebaseServiceAccount;

    // Reactivar tokens para recuperar los que se hayan desactivado por error de formato previo
    await supabaseAdmin.from("device_tokens").update({ activo: true }).eq("activo", false);

    const tokens = await getTargetTokens(supabaseAdmin, payload);
    console.log("[enviar-push] Tokens destino encontrados:", tokens.length);
    if (!tokens.length) return jsonResponse({ sent: 0, message: "No hay tokens activos" });

    const accessToken = await createGoogleAccessToken(account);
    const results = await Promise.all(tokens.map(async (token) => {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: payload.title, body: payload.body },
              data: payload.data ?? {},
              android: {
                priority: "HIGH",
                notification: {
                  color: "#283720",
                  channel_id: "basilico_alta_prioridad",
                  default_sound: true,
                  default_vibrate_timings: true
                }
              }
            }
          })
        }
      );
      const resJson = await response.json();
      console.log("[enviar-push] Respuesta FCM para token:", response.status, JSON.stringify(resJson));
      return { token, ok: response.ok, result: resJson };
    }));

    const invalidos = results
      .filter((r) => {
        if (r.ok) return false;
        const msg = JSON.stringify(r.result || "");
        return msg.includes("UNREGISTERED") || msg.includes("NOT_FOUND");
      })
      .map((r) => r.token);

    if (invalidos.length) {
      await supabaseAdmin
        .from("device_tokens")
        .update({ activo: false, updated_at: new Date().toISOString() })
        .in("token", invalidos);
    }

    return jsonResponse({ sent: results.filter((result) => result.ok).length, failed: results.filter((result) => !result.ok).length, results });
  } catch (error) {
    console.error("Error en enviar-push:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Error interno" }, 500);
  }
});
