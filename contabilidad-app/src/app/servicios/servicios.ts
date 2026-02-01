import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, finalize } from 'rxjs';
import { switchMap, shareReplay } from 'rxjs/operators';
import { ServiciosService } from '../services/servicios.service';
import { DatosPersonalesService, DatosPersonales } from '../services/datos-personales.service';
import { Servicio } from '../models/servicio';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { firstValueFrom } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-servicios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './servicios.html',
  styleUrls: ['./servicios.scss']
})
export class ServiciosListaComponent implements OnInit {
  limit = 50;
  page = 0;
  offset = 0;
  desde = '';
  hasta = '';
  vistaTabla = true;

  // Ordenamiento
  sortBy: 'fecha' = 'fecha';
  sortOrder: 'asc' | 'desc' = 'desc';

  servicios: Servicio[] = [];
  total = 0;
  suma = 0;

  private filtro$ = new BehaviorSubject<{ limit: number; offset: number; desde?: string; hasta?: string }>({
    limit: this.limit, offset: 0, desde: '', hasta: ''
  });

  servicios$: Observable<{ datos: Servicio[]; total: number; suma: number }> = this.filtro$.pipe(
    switchMap(opts => this.serviciosService.list(opts)),
    shareReplay(1)
  );

  loading = false;
  error = '';
  datosPersonales: DatosPersonales | null = null;

  // modal de detalle y edición
  servicioSeleccionado: Servicio | null = null;
  showFormModal = false;
  showSuccessModal = false;
  editingId: number | null = null;
  successMessage = '';
  servicio: Servicio = { codigo: '', fecha: '', importe: 0, descuento: 0, importeFinal: 0 };

  constructor(
    private serviciosService: ServiciosService,
    private datosPersonalesService: DatosPersonalesService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setUltimoMes();
    this.datosPersonalesService.obtener().subscribe({
      next: datos => this.datosPersonales = datos,
      error: () => this.datosPersonales = null
    });
    this.cargarServicios();
  }

  setUltimoMes(): void {
    const hoy = new Date();
    const d = new Date(hoy);
    d.setDate(hoy.getDate() - 30);
    this.desde = d.toISOString().slice(0, 10);
    this.hasta = hoy.toISOString().slice(0, 10);
  }

  cargarServicios(): void {
    this.loading = true;
    this.error = '';
    this.serviciosService
      .list({ limit: this.limit, offset: this.offset, desde: this.desde || undefined, hasta: this.hasta || undefined })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: res => {
          // Calcula importeFinal correctamente para cada servicio
          this.servicios = res.datos.map(s => ({
            ...s,
            importeFinal: Math.round(((s.importe ?? 0) - ((s.importe ?? 0) * (s.descuento ?? 0) / 100)) * 100) / 100
          }));
          this.ordenarServicios();
          this.total = res.total;
          this.suma = res.suma;
          setTimeout(() => this.cd.detectChanges()); // fuerza render en primer clic
        },
        error: err => {
          this.error = 'No se pudieron cargar los servicios';
          console.error(err);
        }
      });
  }

  ordenarServicios(): void {
    this.servicios.sort((a, b) => {
      let aVal: string = a.fecha || '';
      let bVal: string = b.fecha || '';

      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;

      return this.sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  cambiarOrden(): void {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    this.ordenarServicios();
  }

  aplicarFiltro(): void {
    this.page = 0;
    this.offset = 0;
    this.cargarServicios();
    this.filtro$.next({ limit: this.limit, offset: 0, desde: this.desde || undefined, hasta: this.hasta || undefined });
  }

  verTodo(): void {
    this.desde = '';
    this.hasta = '';
    this.aplicarFiltro();
  }

  prev(): void {
    if (this.page > 0) {
      this.page--;
      this.offset = this.page * this.limit;
      this.cargarServicios();
      this.filtro$.next({ limit: this.limit, offset: this.offset, desde: this.desde || undefined, hasta: this.hasta || undefined });
    }
  }

  next(total: number): void {
    if ((this.page + 1) * this.limit < total) {
      this.page++;
      this.offset = this.page * this.limit;
      this.cargarServicios();
      this.filtro$.next({ limit: this.limit, offset: this.offset, desde: this.desde || undefined, hasta: this.hasta || undefined });
    }
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  // formatea nº con coma decimal (es-ES)
  private fmt(n: number): string {
    return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // parsea texto "1.234,56" a número
  private parseEuro(s: string): number {
    const t = String(s).replace(/\./g, '').replace(',', '.');
    const n = Number(t);
    return isNaN(n) ? 0 : n;
  }

  exportarPDF(): void {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = { left: 40, right: 40, top: 95, bottom: 60 };
    const pageWidth = doc.internal.pageSize.getWidth();

    // Encabezado con datos personales (solo primera página)
    if (this.datosPersonales && this.datosPersonales.nombre) {
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      let yPos = 20;
      const rightX = pageWidth - margin.right;
      
      doc.text(this.datosPersonales.nombre, rightX, yPos, { align: 'right' });
      yPos += 12;
      
      if (this.datosPersonales.nif) {
        doc.text(`NIF: ${this.datosPersonales.nif}`, rightX, yPos, { align: 'right' });
        yPos += 12;
      }
      if (this.datosPersonales.direccion) {
        doc.text(this.datosPersonales.direccion, rightX, yPos, { align: 'right' });
        yPos += 12;
      }
      if (this.datosPersonales.codigoPostal || this.datosPersonales.ciudad) {
        const cp = this.datosPersonales.codigoPostal || '';
        const ciudad = this.datosPersonales.ciudad || '';
        doc.text(`${cp} ${ciudad}`.trim(), rightX, yPos, { align: 'right' });
        yPos += 12;
      }
      if (this.datosPersonales.provincia) {
        doc.text(this.datosPersonales.provincia, rightX, yPos, { align: 'right' });
        yPos += 12;
      }
      // Teléfono y email eliminados del encabezado
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Listado de Servicios', margin.left, 40);

    // Filtro fechas
    doc.setFontSize(11);
    const rango =
      this.desde || this.hasta
        ? `Rango: ${this.desde ? this.formatDate(this.desde) : '...'} a ${this.hasta ? this.formatDate(this.hasta) : '...'}`
        : 'Rango: todas las fechas';
    doc.text(rango, margin.left, 58);

    const head = [['Nº', 'Código', 'Fecha', 'Importe €', 'Descuento', 'Final €']];
    const body = this.servicios.map((s, i) => [
      (i + 1).toString(),
      s.codigo,
      s.fecha,
      this.fmt(s.importe ?? 0),
      `${s.descuento ?? 0}`,
      this.fmt(s.importeFinal ?? ((s.importe ?? 0) - ((s.importe ?? 0) * (s.descuento ?? 0) / 100)))
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
      columnStyles: { 3: { halign: 'right' }, 5: { halign: 'right' } },
      showFoot: 'everyPage',
      foot: [[
        { content: '', colSpan: 4, styles: { halign: 'left' } },
        { content: '', colSpan: 2, styles: { halign: 'right' } }
      ]],
      footStyles: { fillColor: [240, 240, 240] },
      didDrawCell: (data: any) => {
        const p = data.pageNumber ?? doc.getCurrentPageInfo().pageNumber;

        // acumula Final € (col 5) por página (índice 5)
        if (data.section === 'body' && data.column.index === 5) {
          const txt = Array.isArray(data.cell.text) ? data.cell.text.join(' ') : String(data.cell.text || '');
          const val = this.parseEuro(txt);
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
            doc.text(`Total página: ${this.fmt(pageTotal)} €`, cell.x + 6, cell.y + cell.height / 2, { baseline: 'middle' });
          }
          if (data.column.index === 4) {
            doc.text(`Acumulado: ${this.fmt(cumTotals[p])} €`, cell.x + cell.width - 6, cell.y + cell.height / 2, {
              baseline: 'middle',
              align: 'right'
            });
          }
        }
      }
    });

    doc.save('servicios.pdf');
  }

  abrirNuevo(): void {
    this.editingId = null;
    this.servicio = { codigo: '', fecha: '', importe: 0, descuento: 0, importeFinal: 0 };
    this.showFormModal = true;
  }

  calcularImporteFinal(): void {
    const importe = this.servicio.importe || 0;
    const descuento = this.servicio.descuento || 0;
    this.servicio.importeFinal = Math.round((importe - (importe * descuento / 100)) * 100) / 100;
  }

  validarPrecioServicio(event: any, field: string): void {
    const value = parseFloat(event.target.value);
    if (value <= 0 && value > 0 === false) {
      if (field === 'importe') {
        this.servicio.importe = 0;
      }
    }
  }

  guardarServicio(): void {
    // Validar que todos los campos sean válidos
    if (!this.servicio.codigo || !this.servicio.fecha || this.servicio.importe <= 0) {
      alert('Por favor, completa todos los campos correctamente. El importe debe ser mayor que 0.');
      return;
    }

    if (this.servicio.descuento < 0 || this.servicio.descuento > 100) {
      alert('El descuento debe estar entre 0 y 100.');
      return;
    } 

    console.log('Guardando con editingId:', this.editingId); // Debug
    const op = this.editingId != null
      ? this.serviciosService.update(this.editingId, this.servicio)
      : this.serviciosService.create(this.servicio);

    op.pipe(finalize(() => this.loading = false)).subscribe({
      next: () => {
        this.successMessage = this.editingId ? '✅ Servicio actualizado' : '✅ Servicio añadido';
        this.showSuccessModal = true;
        this.showFormModal = false;
        const idActualizado = this.editingId; // Guarda el ID para actualizar el modal
        this.editingId = null;
        this.cd.detectChanges();
        
        // Recarga servicios y actualiza el modal de detalle si estaba abierto
        this.serviciosService
          .list({ limit: this.limit, offset: this.offset, desde: this.desde || undefined, hasta: this.hasta || undefined })
          .subscribe({
            next: res => {
              this.servicios = res.datos.map(s => ({
                ...s,
                importeFinal: Math.round(((s.importe ?? 0) - ((s.importe ?? 0) * (s.descuento ?? 0) / 100)) * 100) / 100
              }));
              this.ordenarServicios();
              this.total = res.total;
              this.suma = res.suma;
              
              // Actualiza el modal de detalle con los datos nuevos
              if (idActualizado && this.servicioSeleccionado) {
                const servicioActualizado = this.servicios.find(s => s.id === idActualizado);
                if (servicioActualizado) {
                  this.servicioSeleccionado = servicioActualizado;
                }
              }
              this.cd.detectChanges();
            }
          });
        
        setTimeout(() => {
          this.showSuccessModal = false;
          this.cd.detectChanges();
        }, 2500);
      },
      error: err => {
        console.error(err);
        this.error = 'No se pudo guardar el servicio';
        this.cd.detectChanges();
      }
    });
  }

  cerrarForm(): void {
    this.showFormModal = false;
    this.editingId = null;
  }

  abrirDetalle(s: Servicio): void {
    this.servicioSeleccionado = s;
  }

  cerrarDetalle(): void {
    this.servicioSeleccionado = null;
  }

  editarServicio(s: Servicio): void {
    this.editingId = s.id ?? null;
    this.servicio = {
      ...s,
      codigo: s.codigo,
      fecha: s.fecha,
      importe: s.importe ?? 0,
      descuento: s.descuento ?? 0,
      importeFinal: s.importeFinal ?? ((s.importe ?? 0) - (s.descuento ?? 0))
    };
    this.showFormModal = true;
    console.log('Editando servicio con ID:', this.editingId); // Debug
  }

  borrarServicio(id?: number): void {
    if (id == null) {
      console.warn('No se puede borrar: ID no disponible');
      alert('No se puede borrar: ID no disponible');
      return;
    }
    console.log('Borrando servicio con ID:', id); // Debug
    this.serviciosService.delete(id).subscribe({
      next: () => {
        this.cerrarDetalle();
        this.cargarServicios();
      },
      error: err => {
        console.error('Error al borrar:', err);
        alert('Error al borrar el servicio');
      }
    });
  }
}