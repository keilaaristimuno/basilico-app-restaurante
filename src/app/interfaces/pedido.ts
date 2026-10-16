import { Producto } from './producto';

/**
 * 1. Entidades base tal como se almacenan en Supabase.
 */
export interface Pedido {
  id: string;
  mesa_id: string;
  cliente_id: string;
  estado: string;
  importe_total: number;
  tiempo_estimado: number;
  created_at: string;
  cocina_listo: boolean;
  bar_listo: boolean;
}

export interface PedidoItem {
  id: string;
  pedido_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

/**
 * 2. Interfaces que representan la respuesta exacta de la consulta relacional
 * anidada en Supabase (independientes y sin acoplar campos no seleccionados).
 */
export interface MesaRelacion {
  id: string;
  numero: number;
}

export interface ProductoRelacionCocina {
  id: string;
  nombre: string;
  tipo: Producto['tipo'];
}

export interface PedidoItemRelacionCocina {
  id: string;
  cantidad: number;
  precio_unitario: number;
  productos: ProductoRelacionCocina | null;
}

export interface PedidoSupabaseRelacional {
  id: string;
  estado: string;
  created_at: string;
  cocina_listo: boolean;
  bar_listo: boolean;
  mesas: MesaRelacion | null;
  pedido_items: PedidoItemRelacionCocina[];
}

/**
 * 3. Modelos limpios para la interfaz gráfica (UI) del perfil Cocinero (Punto 16).
 * Diseñados para representar los datos procesados, filtrados por platos
 * y agrupados por número de mesa.
 */

/**
 * Representa un plato de cocina a elaborar con su nombre y cantidad.
 */
export interface ItemPlatoCocinaUI {
  nombre: string;
  cantidad: number;
}

/**
 * Representa un pedido particular de una mesa, con su identificador,
 * su fecha y hora formateada (HH:mm) y los platos correspondientes a cocina.
 */
export interface PedidoMesaCocinaUI {
  pedidoId: string;
  numeroMesa: number;
  fechaHora: string;
  platos: ItemPlatoCocinaUI[];
}

/**
 * Modelo final agrupado por mesa que consume la vista de Angular.
 */
export interface MesaConPedidosCocinaUI {
  numeroMesa: number;
  pedidos: PedidoMesaCocinaUI[];
}

/**
 * 4. Modelos limpios para la interfaz gráfica (UI) del perfil Cantinero / Bar (Punto 17).
 * Diseñados para representar los datos procesados, filtrados por bebidas
 * y agrupados por número de mesa.
 */

export interface ItemBebidaBarUI {
  nombre: string;
  cantidad: number;
}

export interface PedidoMesaBarUI {
  pedidoId: string;
  numeroMesa: number;
  fechaHora: string;
  bebidas: ItemBebidaBarUI[];
}

export interface MesaConPedidosBarUI {
  numeroMesa: number;
  pedidos: PedidoMesaBarUI[];
}

/**
 * 5. Modelos para el Carrito y la experiencia de realización de Pedido del Cliente (Puntos 11, 12, 13).
 */
export interface ItemCarritoPedido {
  producto: Producto;
  cantidad: number;
}

export interface ItemDetallePedidoUI {
  id?: string;
  producto: Producto;
  cantidad: number;
  precio_unitario: number;
}

export interface PedidoClienteUI {
  id: string;
  mesa_id: string;
  numeroMesa: number;
  cliente_id: string;
  estado: string;
  importe_total: number;
  tiempo_estimado: number;
  created_at: string;
  cocina_listo: boolean;
  bar_listo: boolean;
  items: ItemDetallePedidoUI[];
}

/**
 * 6. Modelos para la gestión y autorización/rechazo de Pedidos por parte del Mozo (Puntos 13 y 14).
 */
export interface ItemPedidoMozoUI {
  nombre: string;
  tipo: Producto['tipo'];
  cantidad: number;
  precio_unitario: number;
}

export interface PedidoPendienteMozoUI {
  id: string;
  mesa_id: string;
  numeroMesa: number;
  cliente_id: string;
  clienteNombre: string;
  estado: string;
  importe_total: number;
  tiempo_estimado: number;
  created_at: string;
  fechaHora: string;
  cocina_listo: boolean;
  bar_listo: boolean;
  items: ItemPedidoMozoUI[];
}

/**
 * 7. Sectores que elaboran productos y avisan cuando su parte está lista (Punto 15).
 */
export type SectorPedido = 'cocina' | 'bar';

