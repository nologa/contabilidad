import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IngresosService } from '../services/ingresos.service';
import { Ingreso } from '../models/ingreso';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { finalize } from 'rxjs/operators';
import { DatosPersonalesService, DatosPersonales } from '../services/datos-personales.service';

@Component({
  selector: 'app-ingresos',
  imports: [CommonModule, FormsModule],
  templateUrl: './ingresos.html',
  styleUrls: ['./ingresos.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IngresosComponent implements OnInit {
  ingresoSeleccionado: Ingreso | null = null;

  cerrarDetalle(): void {
    this.ingresoSeleccionado = null;
  }

  editarIngreso(i: Ingreso): void {
    this.editingId = i.id ?? this.obtenerIdPorFecha(i.fecha);
    this.ingreso = { ...i };
    this.showFormModal = true;
    this.cerrarDetalle();
  }

  borrarIngreso(i: Ingreso): void {
    const id = i.id ?? this.obtenerIdPorFecha(i.fecha);
    if (!id) {
      alert('No se pudo identificar el ingreso a borrar');
      return;
    }
    if (!confirm('¿Seguro que deseas borrar este ingreso?')) {
      return;
    }
    this.ingresosService.delete(id).subscribe({
      next: () => {
        this.cerrarDetalle();
        this.cargarIngresos();
      },
      error: () => {
        alert('No se pudo borrar el ingreso');
      }
    });
  }

  filtroDesde: string = '';
  filtroHasta: string = '';
  anoSeleccionado = '';
  mesSeleccionado = '';
  meses = [
    { num: '01', nombre: 'Enero' },
    { num: '02', nombre: 'Febrero' },
    { num: '03', nombre: 'Marzo' },
    { num: '04', nombre: 'Abril' },
    { num: '05', nombre: 'Mayo' },
    { num: '06', nombre: 'Junio' },
    { num: '07', nombre: 'Julio' },
    { num: '08', nombre: 'Agosto' },
    { num: '09', nombre: 'Septiembre' },
    { num: '10', nombre: 'Octubre' },
    { num: '11', nombre: 'Noviembre' },
    { num: '12', nombre: 'Diciembre' }
  ];
  anos: number[] = [];
  sortBy: 'fecha' = 'fecha';
  sortOrder: 'asc' | 'desc' = 'desc';
  vistaTabla = true;
  totalIngresos = 0;
  sumaTotal = 0;
  ingresos: Ingreso[] = [];
  ingreso: Ingreso = { fecha: '', x: 0, y: 0, servicios: 0 };
  showFormModal = false;
  editingId: number | null = null;
  loading = false;
  error = '';
  datosPersonales: DatosPersonales | null = null;
  guardando = false;

  exportarPDF(): void {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = { left: 40, right: 40, top: 95, bottom: 60 };
    const pageWidth = doc.internal.pageSize.getWidth();
    const head = [['Nº', 'Fecha', 'X', 'Y', 'Servicios', 'Total']];
    const body = this.ingresos.map((i, idx) => [
      (idx + 1).toString(),
      i.fecha ?? '',
      i.x ?? '',
      i.y ?? '',
      i.servicios ?? '',
      (i.y - i.x).toString()
    ]);
    const pageTotals: Record<number, number> = {};
    const cumTotals: Record<number, number> = {};

    autoTable(doc, {
      head,
      body,
      startY: margin.top,
      margin,
      styles: { fontSize: 10, textColor: [0, 0, 0] },
      headStyles: { fillColor: [110, 193, 255], textColor: [0, 0, 0] },
      columnStyles: { 0: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      showFoot: 'everyPage',
      foot: [[
        { content: '', colSpan: 4, styles: { halign: 'left' } },
        { content: '', colSpan: 2, styles: { halign: 'right' } }
      ]],
      footStyles: { fillColor: [240, 240, 240] },
      didDrawPage: (data: any) => {
        if (data.pageNumber === 1 && this.datosPersonales) {
          let yPos = 20;
          doc.setFontSize(9);
          doc.setTextColor(80, 80, 80);
          const rightX = pageWidth - margin.right;
          if (this.datosPersonales.nombre) {
            doc.text(this.datosPersonales.nombre, rightX, yPos, { align: 'right' });
            yPos += 12;
          }
          if (this.datosPersonales.nif) {
            doc.text(`NIF: ${this.datosPersonales.nif}`, rightX, yPos, { align: 'right' });
            yPos += 12;
          }
        }
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('Listado de Ingresos', margin.left, 40);
        doc.setFontSize(11);
        const rangoTexto = this.filtroDesde || this.filtroHasta 
          ? `Rango: ${this.filtroDesde || 'sin fecha inicio'} a ${this.filtroHasta || 'sin fecha fin'}`
          : 'Rango: todas las fechas';
        doc.text(rangoTexto, margin.left, 58);
      },
      didDrawCell: (data: any) => {
        const p = data.pageNumber || doc.getCurrentPageInfo().pageNumber;
        if (data.section === 'body' && data.column.index === 4) {
          const txt = Array.isArray(data.cell.text) ? data.cell.text.join(' ') : String(data.cell.text || '');
          const val = Number(txt.replace(/,/g, '.')) || 0;
          pageTotals[p] = (pageTotals[p] || 0) + val;
        }
        if (data.section === 'foot') {
          const prev = p > 1 ? (cumTotals[p - 1] || 0) : 0;
          const pageTotal = pageTotals[p] || 0;
          cumTotals[p] = prev + pageTotal;
          const { cell } = data;
          doc.setFontSize(10);
          doc.setTextColor(0, 0, 0);
          if (data.column.index === 0) {
            doc.text(`Total página: ${pageTotal.toFixed(2)} €`, cell.x + 6, cell.y + cell.height / 2, { baseline: 'middle' });
          }
          if (data.column.index === 4) {
            doc.text(`Acumulado: ${cumTotals[p].toFixed(2)} €`, cell.x + cell.width - 6, cell.y + cell.height / 2, {
              baseline: 'middle',
              align: 'right'
            });
          }
        }
      }
    });
    doc.save('ingresos.pdf');
  }

  constructor(
    private ingresosService: IngresosService,
    private datosPersonalesService: DatosPersonalesService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.datosPersonalesService.obtener().subscribe({
      next: datos => this.datosPersonales = datos,
      error: () => this.datosPersonales = null
    });
    this.cargarIngresos();
  }

  cargarIngresos(): void {
    this.loading = true;
    this.ingresosService.list().subscribe({
      next: res => {
        let lista = (res.datos as any[]).map((i: any) => ({
          ...i,
          servicios: i.servicios ?? 0,
          total: i.y - i.x
        }));

        const anosUnicos = new Set<number>();
        lista.forEach(i => {
          const ano = parseInt(i.fecha.split('-')[0]);
          if (!isNaN(ano)) anosUnicos.add(ano);
        });
        this.anos = Array.from(anosUnicos).sort((a, b) => a - b);

        if (this.filtroDesde) {
          lista = lista.filter(i => i.fecha >= this.filtroDesde);
        }
        if (this.filtroHasta) {
          lista = lista.filter(i => i.fecha <= this.filtroHasta);
        }
        lista = lista.sort((a, b) => {
          const aVal = (a.fecha || '').replace(/-/g, '');
          const bVal = (b.fecha || '').replace(/-/g, '');
          if (aVal < bVal) return this.sortOrder === 'asc' ? -1 : 1;
          if (aVal > bVal) return this.sortOrder === 'asc' ? 1 : -1;
          return 0;
        });

        this.ingresos = lista;
        this.totalIngresos = lista.length;
        this.sumaTotal = lista.reduce((acc, i) => acc + (i.servicios || 0), 0);
        this.loading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.error = 'No se pudieron cargar los ingresos';
        this.loading = false;
      }
    });
  }

  aplicarFiltro(): void {
    this.cargarIngresos();
  }

  filtroUltimos30Dias(): void {
    const hoy = new Date();
    const desde = new Date(hoy);
    desde.setDate(hoy.getDate() - 29);
    this.filtroDesde = desde.toISOString().slice(0, 10);
    this.filtroHasta = hoy.toISOString().slice(0, 10);
    this.anoSeleccionado = '';
    this.mesSeleccionado = '';
    this.cargarIngresos();
    this.cd.detectChanges();
  }

  cambiarMes(): void {
    if (!this.anoSeleccionado) {
      this.filtroDesde = '';
      this.filtroHasta = '';
      return;
    }

    if (!this.mesSeleccionado) {
      this.filtroDesde = `${this.anoSeleccionado}-01-01`;
      this.filtroHasta = `${this.anoSeleccionado}-12-31`;
    } else {
      this.filtroDesde = `${this.anoSeleccionado}-${this.mesSeleccionado}-01`;
      const ultimoDia = new Date(parseInt(this.anoSeleccionado), parseInt(this.mesSeleccionado), 0).getDate();
      this.filtroHasta = `${this.anoSeleccionado}-${this.mesSeleccionado}-${ultimoDia.toString().padStart(2, '0')}`;
    }
    this.aplicarFiltro();
  }

  borrarFiltros(): void {
    this.filtroDesde = '';
    this.filtroHasta = '';
    this.cargarIngresos();
    this.cd.detectChanges();
  }

  abrirNueva(): void {
    this.editingId = null;
    this.ingreso = { fecha: '', x: 0, y: 0, servicios: 0 };
    this.showFormModal = true;
  }

  abrirDetalle(i: Ingreso): void {
    this.ingresoSeleccionado = i;
  }

  private obtenerIdPorFecha(fecha: string): number | null {
    const encontrado = this.ingresos.find(i => i.fecha === fecha && i.id != null);
    return encontrado?.id ?? null;
  }

  guardarIngreso(): void {
    if (this.guardando) {
      return;
    }
    this.guardando = true;
    this.cd.markForCheck();

    if (!this.ingreso.fecha || this.ingreso.x == null || this.ingreso.y == null || this.ingreso.servicios == null) {
      alert('Todos los campos son obligatorios');
      this.guardando = false;
      this.cd.markForCheck();
      return;
    }

    if (this.ingreso.y < this.ingreso.x) {
      alert('Y no puede ser menor que X');
      this.guardando = false;
      this.cd.markForCheck();
      return;
    }

    if (this.ingreso.servicios < 0) {
      alert('Servicios no puede ser menor que 0');
      this.guardando = false;
      this.cd.markForCheck();
      return;
    }

    if (!this.editingId && this.existeDuplicada(this.ingreso)) {
      alert('Ya existe un ingreso con la misma fecha. No se puede duplicar.');
      this.guardando = false;
      this.cd.markForCheck();
      return;
    }

    const op = this.editingId
      ? this.ingresosService.update(this.editingId, this.ingreso)
      : this.ingresosService.create(this.ingreso);

    op.pipe(
      finalize(() => {
        this.guardando = false;
        this.cd.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.showFormModal = false;
        this.cargarIngresos();
      },
      error: () => {
        alert('No se pudo guardar el ingreso');
      }
    });
  }

  private existeDuplicada(i: Ingreso): boolean {
    const fecha = (i.fecha || '').trim();
    return this.ingresos.some(x => (x.fecha || '').trim() === fecha);
  }
}
