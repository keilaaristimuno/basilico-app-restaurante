# Basilico - Proyecto de Gestión de Restaurante 🍽️
### **Grupo:** Basilico - 2026

### **Tecnicatura Universitaria en Programación - UTN Avellaneda**

 `Link del proyecto Supabase:` https://xmlcpvfjlnuakqehrvom.supabase.co --> integrado al repo
---

## 👥 Integrantes y Responsabilidades

De acuerdo con las pautas del Trabajo Final Integrador, a continuación se detallan los módulos asignados, las fechas estimadas de desarrollo y las ramas de trabajo de cada integrante:

### Francisco Cuenca Backoffice (Dueño / Supervisor)
Puntos del enunciado: 1, 4, 6, 7, 8, 22, 25
Punto 1 — Alta de empleado (foto desde cámara, lectura QR de DNI, validaciones)
Punto 4 — Alta y gestión de mesas (tipo, disponibilidad, foto) + generación automática de QR de mesa
Punto 6 — Listado de clientes pendientes de aprobación (con push notification)
Punto 7 y 8 — Aceptar/rechazar cliente + envío de correo automático personalizado (logo, fuentes,
colores propios)
Punto 22 — Generación de factura en PDF + notificación automática a dueño/supervisor tras el pago
Punto 25 — Aprobación/rechazo de reservas (segunda/tercera fecha)

### Keila Aristimuño— Cocina y Bar (Productos)
Puntos del enunciado: 2, 3, 16, 17, 18
Punto 2 — Alta de plato (nombre, descripción, tiempo, precio, 3 fotos con carrusel)
Punto 3 — Alta de bebida (misma lógica que plato)
Punto 16 — Pantalla de pedidos pendientes en cocina, agrupados por mesa
Punto 17 — Pantalla de pedidos pendientes en bar, agrupados por mesa
Punto 18 — Marcar productos listos y avisar al mozo cuando el pedido está completo (push notification)

### Ignacio Arriaga — Experiencia del Cliente
Puntos del enunciado: 5, 9, 11, 12, 13, 14, 15, 20, 21
Punto 5 — Registro de cliente registrado (foto, DNI con QR, estado "pendiente de aprobación")
Punto 9 — Ingreso como cliente anónimo + anotarse en lista de espera
Punto 11 — Ver menú de productos (carrusel de imágenes, precio, descripción, tiempo)
Punto 12, 13, 14 — Armar pedido (con importe acumulado siempre visible), modificarlo si el mozo lo
rechaza, ver estado
Punto 15 — Sección de juegos (3 juegos simples con descuentos 10/15/20%)
Punto 20 — Encuesta de satisfacción + visualización de resultados en gráficos
Punto 21 — Pedir la cuenta, elegir propina vía QR, ver detalle y total

### Seggiaro Agustina — Mozo / Metre + Infraestructura transversal
Puntos del enunciado: 10, 11 (consulta al mozo), 19, + tareas transversales
Punto 10 — Lista de espera del metre + asignación de mesa a cliente
Punto 11 (parte mozo) — Recepción de "consulta al mozo" + sala de conversación estilo chat
Punto 12/13/14 (parte mozo) — Confirmar o rechazar pedido, derivarlo a sectores
Punto 19 — Entrega del pedido completo + cambio de estado
Liderar el servicio central de Supabase y el sistema de notificaciones push (por ser quien más interactúacon todos los flujos)


### 👤 Aristimuño, Keila del Integrante 1 - Líder del Grupo
* **Módulos / Objetivos a desarrollar:** 
  -  Alta de plato (nombre, descripción, tiempo, precio, 3 fotos con carrusel
* **Planificación de Tareas:**

| Tarea / Módulo | Fecha Inicio | Fecha Fin (Estimada/Real) | Branch | Estado |
| :--- | :---: | :---: | :---: | :---: |
| Configuración inicial del repositorio | 28/08/2026 | 28/08/2026 | `main` / `develop` | Finalizado |
| Estilos generales | 05/09/2026 | 05/09/2026 | `feature/estilos-globales` | Finalizado|
|Punto 2 — Alta de plato | 10/09 | 12/09 |feature/alta-plato |En proceso |


---

### 👤 Cuenca, Francisco

* **Planificación de Tareas:**

| Tarea / Módulo | Fecha Inicio | Fecha Fin | Branch | Estado |
| :--- | :---: | :---: | :---: | :---: |
| Sevicio reutilizable de QR | 04/09/2026 | 04/09/2026 | `feature/qr-service` | Finalizado |
| Punto 1 — Alta de empleado | 05/09/2026 | - | `feature/alta-empleado` | En proceso |

---
### 👤 Ignacio Arriaga
* **Módulos / Objetivos a desarrollar:** 
* **Planificación de Tareas:**

| Tarea / Módulo | Fecha Inicio | Fecha Fin (Estimada/Real) | Branch | Estado |
| :--- | :---: | :---: | :---: | :---: |
| Desarrollo del Juego de Descuento (10%, 15%, 20%) | DD/MM/2026 | DD/MM/2026 | `feature/juegos` | Pendiente |
| [Módulo W] | DD/MM/2026 | DD/MM/2026 | `feature/modulo-w` | Pendiente |

---
### 👤 Seggiaro, Agustina Anabel
* **Módulos / Objetivos a desarrollar:** 
 - Login principal
* **Planificación de Tareas:**

| Tarea / Módulo | Fecha Inicio | Fecha Fin (Estimada/Real) | Branch | Estado |
| :--- | :---: | :---: | :---: | :---: |
| Login principal (Validaciones) | 08/09/2026 | 10/09/2026 | `feature/registro-login` | Finalizado |
| Pantalla de incio (Redirigir) | 08/09/2026 | 10/09/2026 | `feature/registro-login` | Finalizado |
| Acceso rápido (Redirigir) | 10/09/2026 | - | `feature/registro-login` | En procceso |
| Pantalla inicio Metre | 10/09/2026 | - | `feature/registro-login` | En procceso |

---

## 📲 Códigos QR del Proyecto
*Requisito excluyente: Todos los códigos QR deben estar disponibles para las pruebas.*

* **QR de Ingreso al Local:**  
  ![QR Ingreso](path/a/tu/imagen/qr-ingreso.png)
* **QRs de Mesas (Mesas 1 a 5):**  
  - Mesa 1: ![Mesa 1](path/a/tu/imagen/qr-mesa1.png)  
  - Mesa 2: ![Mesa 2](path/a/tu/imagen/qr-mesa2.png)
* **QRs de Propinas (Nivel de Satisfacción):**  
  - Excelente (20%): ![Propina Excelente](path/a/tu/imagen/qr-propina-20.png)  
  - Muy Bueno (15%): ![Propina Muy Bueno](path/a/tu/imagen/qr-propina-15.png)  
  - Bueno (10%): ![Propina Bueno](path/a/tu/imagen/qr-propina-10.png)  
  - Regular (5%): ![Propina Regular](path/a/tu/imagen/qr-propina-5.png)  
  - Malo (0%): ![Propina Malo](path/a/tu/imagen/qr-propina-0.png)

---

## 🖼️ Índice de Imágenes del Proyecto
*Requisito obligatorio: Índice para visualizar todas las imágenes asociadas al proyecto (íconos, pantallas de presentación, formularios, listados, etc.).*

### 🎨 Diseño de Identidad
- **Ícono de la Aplicación:** ![Logo](path/a/tu/imagen/app-icon.png)
- **Splash Screen (Presentación):** ![Splash](path/a/tu/imagen/splash-screen.png)

### 📱 Formularios y Pantallas
1. **Alta de Empleados:** ![Alta Empleados](path/a/tu/imagen/pantalla-empleado.png)
2. **Alta de Platos / Bebidas:** ![Alta Platos](path/a/tu/imagen/pantalla-platos.png)
3. **Listado de Clientes Pendientes:** ![Clientes Pendientes](path/a/tu/imagen/pantalla-clientes-pendientes.png)
4. **Menú de Productos:** ![Menú](path/a/tu/imagen/pantalla-menu.png)
5. **Sala de Conversación (Chat Mozo-Cliente):** ![Chat](path/a/tu/imagen/pantalla-chat.png)
6. **Gráficos Estadísticos (Encuestas):** ![Gráficos](path/a/tu/imagen/pantalla-graficos.png)
7. **Juegos de Descuento:** ![Juegos](path/a/tu/imagen/pantalla-juegos.png)

*(Agregaremos aquí capturas de todas las pantallas y elementos visuales a medida que los vayan desarrollando).*

---

# PALETA DE COLORES
  - ROJO ANARANJADO
    RGB: #b24d39
  - VERDE OLIVA
    RGB: #283720
  - BEIGE
    RGB: #ede5d2

