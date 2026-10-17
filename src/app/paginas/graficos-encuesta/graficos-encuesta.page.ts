import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSpinner
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  barChartOutline,
  pieChartOutline,
  trendingUpOutline,
  chevronBackOutline,
  chevronForwardOutline,
  refreshOutline,
  peopleOutline,
  starOutline
} from 'ionicons/icons';

import { Supabase } from '../../services/supabase';
import { EncuestaRegistro } from '../../interfaces/encuesta';

export interface BarraEstadistica {
  etiqueta: string;
  promedio: number;
  porcentajeAltura: number;
  color: string;
}

export interface SectorTorta {
  etiqueta: string;
  cantidad: number;
  porcentaje: number;
  color: string;
  pathD: string;
}

export interface PuntoLineal {
  indice: number;
  etiqueta: string;
  valor: number;
  x: number;
  y: number;
}

@Component({
  selector: 'app-graficos-encuesta',
  standalone: true,
  templateUrl: './graficos-encuesta.page.html',
  styleUrls: ['./graficos-encuesta.page.scss'],
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonSpinner
  ]
})
export class GraficosEncuestaPage implements OnInit {
  // Controla cuál de las 3 pantallas de gráficos está activa (1 gráfico por pantalla)
  pantallaActiva = signal<'barras' | 'torta' | 'lineal'>('barras');

  cargando = signal<boolean>(true);
  encuestas = signal<EncuestaRegistro[]>([]);

  totalEncuestas = computed(() => this.encuestas().length);

  promedioGeneral = computed(() => {
    const lista = this.encuestas();
    if (lista.length === 0) return 0;
    const suma = lista.reduce((acc, item) => acc + this.calcularPromedioItem(item), 0);
    return Number((suma / lista.length).toFixed(1));
  });

  // 1. DATOS PARA GRÁFICO DE BARRAS (3 categorías numéricas: Comida, Atención, Ambiente)
  datosBarras = computed<BarraEstadistica[]>(() => {
    const lista = this.encuestas();
    if (lista.length === 0) {
      return [
        { etiqueta: 'Comida', promedio: 0, porcentajeAltura: 0, color: '#b24d39' },
        { etiqueta: 'Atención', promedio: 0, porcentajeAltura: 0, color: '#283720' },
        { etiqueta: 'Ambiente', promedio: 0, porcentajeAltura: 0, color: '#4f6d3a' }
      ];
    }

    const n = lista.length;
    const promComida = Number((lista.reduce((a, e) => a + Number(e.respuestas?.comida ?? 0), 0) / n).toFixed(1));
    const promAtencion = Number((lista.reduce((a, e) => a + Number(e.respuestas?.atencion ?? 0), 0) / n).toFixed(1));
    const promAmbiente = Number((lista.reduce((a, e) => a + Number(e.respuestas?.ambiente ?? 0), 0) / n).toFixed(1));

    return [
      { etiqueta: 'Comida', promedio: promComida, porcentajeAltura: Math.min(100, promComida * 10), color: '#b24d39' },
      { etiqueta: 'Atención', promedio: promAtencion, porcentajeAltura: Math.min(100, promAtencion * 10), color: '#283720' },
      { etiqueta: 'Ambiente', promedio: promAmbiente, porcentajeAltura: Math.min(100, promAmbiente * 10), color: '#4f6d3a' }
    ];
  });

  // 2. DATOS PARA GRÁFICO DE TORTA (5 niveles de Experiencia General)
  datosTorta = computed<SectorTorta[]>(() => {
    const lista = this.encuestas();
    const total = lista.length;

    let excelente = 0; // 10 (o >= 9)
    let muyBueno = 0;  // 8 (o 7 a 8)
    let bueno = 0;     // 6 (o 5 a 6)
    let regular = 0;   // 4 (o 3 a 4)
    let malo = 0;      // 2 (o <= 2)

    for (const item of lista) {
      const exp = Number(item?.respuestas?.recomienda ?? 0);
      if (exp >= 9) excelente++;
      else if (exp >= 7) muyBueno++;
      else if (exp >= 5) bueno++;
      else if (exp >= 3) regular++;
      else malo++;
    }

    const crudos = [
      { etiqueta: 'Excelente', cantidad: excelente, color: '#283720' },
      { etiqueta: 'Muy Bueno', cantidad: muyBueno, color: '#4f6d3a' },
      { etiqueta: 'Bueno', cantidad: bueno, color: '#c87d32' },
      { etiqueta: 'Regular', cantidad: regular, color: '#d96b43' },
      { etiqueta: 'Malo', cantidad: malo, color: '#b24d39' }
    ];

    if (total === 0) {
      return crudos.map(c => ({ ...c, porcentaje: 0, pathD: '' }));
    }

    let anguloAcumulado = -90; // Arranca arriba a las 12 en punto
    const cx = 100;
    const cy = 100;
    const r = 92;

    return crudos.map(sector => {
      const porcentaje = Math.round((sector.cantidad / total) * 100);
      const fraccion = sector.cantidad / total;
      const anguloSector = fraccion * 360;

      if (sector.cantidad === 0) {
        return { ...sector, porcentaje: 0, pathD: '' };
      }

      // Si un único sector tiene el 100%, dibujamos círculo completo con dos arcos
      if (fraccion >= 0.999) {
        const pathCompleto = [
          `M ${cx} ${cy - r}`,
          `A ${r} ${r} 0 1 1 ${cx} ${cy + r}`,
          `A ${r} ${r} 0 1 1 ${cx} ${cy - r}`,
          'Z'
        ].join(' ');
        return { ...sector, porcentaje: 100, pathD: pathCompleto };
      }

      const anguloInicioRad = (anguloAcumulado * Math.PI) / 180;
      const anguloFinRad = ((anguloAcumulado + anguloSector) * Math.PI) / 180;

      const x1 = cx + r * Math.cos(anguloInicioRad);
      const y1 = cy + r * Math.sin(anguloInicioRad);
      const x2 = cx + r * Math.cos(anguloFinRad);
      const y2 = cy + r * Math.sin(anguloFinRad);

      const largeArcFlag = anguloSector > 180 ? 1 : 0;

      const pathD = [
        `M ${cx} ${cy}`,
        `L ${x1.toFixed(2)} ${y1.toFixed(2)}`,
        `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
        'Z'
      ].join(' ');

      anguloAcumulado += anguloSector;

      return {
        ...sector,
        porcentaje,
        pathD
      };
    });
  });

  // 3. DATOS PARA GRÁFICO LINEAL (Últimas 8 encuestas)
  puntosLineales = computed<PuntoLineal[]>(() => {
    const ultimas = this.encuestas().slice(-8);
    if (ultimas.length === 0) return [];

    const anchoUtil = 260; // de x=35 a x=295
    const altoUtil = 130;  // de y=20 (valor 10) a y=150 (valor 0)
    const xBase = 35;
    const yBase = 150;

    return ultimas.map((enc, idx) => {
      const valor = Number(this.calcularPromedioItem(enc).toFixed(1));
      const x = ultimas.length === 1
        ? xBase + anchoUtil / 2
        : xBase + (idx / (ultimas.length - 1)) * anchoUtil;
      const y = yBase - (Math.min(10, Math.max(0, valor)) / 10) * altoUtil;

      return {
        indice: idx + 1,
        etiqueta: `#${idx + 1}`,
        valor,
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1))
      };
    });
  });

  polilineaSvg = computed(() => {
    const pts = this.puntosLineales();
    if (pts.length === 0) return '';
    return pts.map(p => `${p.x},${p.y}`).join(' ');
  });

  areaLinealSvg = computed(() => {
    const pts = this.puntosLineales();
    if (pts.length === 0) return '';
    const primero = pts[0];
    const ultimo = pts[pts.length - 1];
    const linea = pts.map(p => `${p.x},${p.y}`).join(' ');
    return `${primero.x},150 ${linea} ${ultimo.x},150`;
  });

  estadisticasLineal = computed(() => {
    const pts = this.puntosLineales();
    if (pts.length === 0) {
      return { min: 0, max: 0, ultimo: 0 };
    }
    const valores = pts.map(p => p.valor);
    return {
      min: Math.min(...valores),
      max: Math.max(...valores),
      ultimo: valores[valores.length - 1]
    };
  });

  constructor(private supabase: Supabase) {
    addIcons({
      barChartOutline,
      pieChartOutline,
      trendingUpOutline,
      chevronBackOutline,
      chevronForwardOutline,
      refreshOutline,
      peopleOutline,
      starOutline
    });
  }

  async ngOnInit() {
    await this.cargarEncuestas();
  }

  async ionViewWillEnter() {
    await this.cargarEncuestas();
  }

  async cargarEncuestas() {
    this.cargando.set(true);
    try {
      const data = await this.supabase.obtenerTodasLasEncuestas();
      this.encuestas.set(data as EncuestaRegistro[]);
    } catch (error) {
      console.error('Error al cargar encuestas:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarPantalla(ev: any) {
    const val = ev?.detail?.value;
    if (val === 'barras' || val === 'torta' || val === 'lineal') {
      this.pantallaActiva.set(val);
    }
  }

  irAPantalla(tipo: 'barras' | 'torta' | 'lineal') {
    this.pantallaActiva.set(tipo);
  }

  pantallaAnterior() {
    const actual = this.pantallaActiva();
    if (actual === 'torta') this.pantallaActiva.set('barras');
    else if (actual === 'lineal') this.pantallaActiva.set('torta');
    else this.pantallaActiva.set('lineal');
  }

  pantallaSiguiente() {
    const actual = this.pantallaActiva();
    if (actual === 'barras') this.pantallaActiva.set('torta');
    else if (actual === 'torta') this.pantallaActiva.set('lineal');
    else this.pantallaActiva.set('barras');
  }

  numeroPantallaActual(): number {
    const actual = this.pantallaActiva();
    if (actual === 'barras') return 1;
    if (actual === 'torta') return 2;
    return 3;
  }

  private calcularPromedioItem(item: EncuestaRegistro): number {
    const r = item?.respuestas;
    if (!r) return 0;
    const c = Number(r.comida ?? 0);
    const a = Number(r.atencion ?? 0);
    const am = Number(r.ambiente ?? 0);
    const re = Number(r.recomienda ?? 0);
    return (c + a + am + re) / 4;
  }
}

