export interface RespuestasEncuesta {
  comida: number;
  atencion: number;
  ambiente: number;
  recomienda: number;
}

export interface EncuestaRegistro {
  id: string;
  cliente_id: string;
  mesa_id: string | null;
  respuestas: RespuestasEncuesta;
  created_at: string;
}

