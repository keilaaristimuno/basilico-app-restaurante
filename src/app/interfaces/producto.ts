export interface Producto {
    id: string;
    nombre: string;
    descripcion: string;
    tiempo_elaboracion: number;
    precio: number;
    tipo: 'plato' | 'bebida';
    fotos: string[];
}
