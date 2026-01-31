import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { FacturasService } from '../services/facturas.service';
import { EmpresasService, EmpresaDTO } from '../services/empresas.service';
import { DatosPersonalesService, DatosPersonales } from '../services/datos-personales.service';
import { Factura } from '../models/factura';
import { EsNumberPipe } from '../pipes/es-number.pipe';
import { NgZone } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-facturas',
  standalone: true,
  imports: [CommonModule, FormsModule, EsNumberPipe],
  templateUrl: './facturas.html',        
  styleUrls: ['./facturas.scss']          
})
export class FacturasListaComponent implements OnInit {
  limit = 50;
  page = 0;
  offset = 0;
  desde = '';
  hasta = '';
  empresaFiltro = '';

  // Ordenamiento
  sortBy: 'fecha' | 'empresa' = 'fecha';
  sortOrder: 'asc' | 'desc' = 'desc';

  facturas: Factura[] = [];
  total = 0;
  suma = 0;

  loading = false;
  error = '';

  factura: Factura = { codigo: '', fecha: '', empresa: '', cif: '', baseImponible: 0, porcentajeIVA: 21 };
  showFormModal = false;
  editingId: number | null = null;

  facturaSeleccionada: Factura | null = null;

  showSuccessModal = false;
  successMessage = '';
  successData: any = null;

  empresas: EmpresaDTO[] = [];
  empresasSugeridas: EmpresaDTO[] = [];
  datosPersonales: DatosPersonales | null = null;

  constructor(
    private facturasService: FacturasService,
    private empresasSvc: EmpresasService,
    private datosPersonalesService: DatosPersonalesService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.empresasSvc.getAll().subscribe(list => (this.empresas = list));
    this.datosPersonalesService.obtener().subscribe({
      next: datos => this.datosPersonales = datos,
      error: () => this.datosPersonales = null
    });
    this.cargarFacturas();
  }

  cargarFacturas(): void {
    this.loading = true;
    this.error = '';
    this.facturasService
      .list({
        limit: this.limit,
        offset: this.offset,
        desde: this.desde || undefined,
        hasta: this.hasta || undefined,
        empresa: this.empresaFiltro || undefined
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: res => {
          this.facturas = res.datos;
          this.ordenarFacturas();
          this.total = res.total;
          this.suma = res.suma;
          setTimeout(() => this.cd.detectChanges(), 0);
        },
        error: err => {
          console.error('[Facturas] error', err);
          this.error = 'No se pudieron cargar las facturas';
        }
      });
  }

  ordenarFacturas(): void {
    this.facturas.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      if (this.sortBy === 'fecha') {
        aVal = a.fecha || '';
        bVal = b.fecha || '';
      } else if (this.sortBy === 'empresa') {
        aVal = (a.empresa || '').toLowerCase();
        bVal = (b.empresa || '').toLowerCase();
      }

      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;

      return this.sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  cambiarOrden(columna: 'fecha' | 'empresa'): void {
    if (this.sortBy === columna) {
      // Si es la misma columna, cambiar dirección
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      // Si es diferente, establecer nueva columna con orden ascendente
      this.sortBy = columna;
      this.sortOrder = 'asc';
    }
    this.ordenarFacturas();
  }

  // Validaciones
  esEmpresaValida(empresa: string): boolean {
    // Solo letras, espacios y puntos
    return /^[a-zA-Z\s.]*$/.test(empresa);
  }

  validarEmpresa(empresa: string): string {
    // Filtra caracteres inválidos, mantiene solo letras, espacios y puntos
    return empresa.replace(/[^a-zA-Z\s.]/g, '');
  }

  validarPrecio(event: any, field: string): void {
    const value = parseFloat(event.target.value);
    if (value <= 0 && value > 0 === false) {
      if (field === 'baseImponible') {
        this.factura.baseImponible = 0;
      }
    }
  }

  aplicarFiltros(): void {
    this.page = 0;
    this.offset = 0;
    this.cargarFacturas();
  }

  limpiarFiltros(): void {
    this.desde = '';
    this.hasta = '';
    this.empresaFiltro = '';
    this.page = 0;
    this.offset = 0;
    this.cargarFacturas();
  }

  prev(): void {
    if (this.page > 0) {
      this.page--;
      this.offset = this.page * this.limit;
      this.cargarFacturas();
    }
  }

  next(): void {
    if ((this.page + 1) * this.limit < this.total) {
      this.page++;
      this.offset = this.page * this.limit;
      this.cargarFacturas();
    }
  }

  abrirNueva(): void {
    this.editingId = null;
    this.factura = { codigo: '', fecha: '', empresa: '', cif: '', baseImponible: 0, porcentajeIVA: 21 };
    this.showFormModal = true;
  }

  calcularIVA(): void {
    const valorIVA = this.factura.baseImponible * (this.factura.porcentajeIVA / 100);
    this.factura.valorIVA = Math.round(valorIVA * 100) / 100;
    this.factura.total = Math.round((this.factura.baseImponible + this.factura.valorIVA) * 100) / 100;
  }

  guardarFactura(): void {
    // Validar que todos los campos sean válidos
    if (!this.factura.codigo || !this.factura.fecha || !this.factura.empresa || !this.factura.cif || this.factura.baseImponible <= 0) {
      alert('Por favor, completa todos los campos correctamente. La base imponible debe ser mayor que 0.');
      return;
    }

    // Validar que la empresa solo contenga letras, espacios y puntos
    if (!this.esEmpresaValida(this.factura.empresa)) {
      alert('El nombre de la empresa solo puede contener letras, espacios y puntos.');
      return;
    }

    this.calcularIVA();
    const op = this.editingId
      ? this.facturasService.update(this.editingId, this.factura)
      : this.facturasService.create(this.factura);

    op.subscribe(() => {
      this.successMessage = this.editingId ? '✅ Factura actualizada' : '✅ Factura añadida';
      this.successData = { ...this.factura };
      this.showSuccessModal = true;
      this.showFormModal = false;
      this.editingId = null;
      this.cargarFacturas();
      setTimeout(() => this.showSuccessModal = false, 2500);
    });
  }

  abrirDetalle(f: Factura): void {
    this.facturaSeleccionada = { ...f };
  }

  cerrarDetalle(): void {
    this.facturaSeleccionada = null;
  }

  editarFactura(f: Factura): void {
    this.editingId = f.id || null;
    this.factura = { ...f };
    this.showFormModal = true;
    this.cerrarDetalle();
  }

  borrarFactura(id?: number): void {
    if (!id) return;
    if (confirm('¿Estás seguro de eliminar esta factura?')) {
      this.facturasService.delete(id).subscribe(() => {
        this.cargarFacturas();
        this.cerrarDetalle();
      });
    }
  }

  cerrarForm(): void {
    this.showFormModal = false;
    this.editingId = null;
  }

  // Formatea 'YYYY-MM-DD' a 'DD/MM/YYYY'
  private formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  private fmt(n: number): string {
    return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private parseEuro(s: string): number {
    const t = s.replace(/\./g, '').replace(',', '.');
    return Number(t) || 0;
  }

  private toYMD(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  setUltimos30Dias(): void {
    const hoy = new Date();
    const hace30 = new Date();
    hace30.setDate(hoy.getDate() - 30);
    this.desde = this.toYMD(hace30);
    this.hasta = this.toYMD(hoy);
    this.page = 0;
    this.offset = 0;
    this.cargarFacturas();
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
      if (this.datosPersonales.telefono) {
        doc.text(`Tel: ${this.datosPersonales.telefono}`, rightX, yPos, { align: 'right' });
        yPos += 12;
      }
      if (this.datosPersonales.email) {
        doc.text(this.datosPersonales.email, rightX, yPos, { align: 'right' });
      }
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Listado de Facturas', margin.left, 40);

    // Filtros
    doc.setFontSize(11);
    const rango =
      this.desde || this.hasta
        ? `Rango: ${this.desde ? this.formatDate(this.desde) : '...'} a ${this.hasta ? this.formatDate(this.hasta) : '...'}`
        : 'Rango: todas las fechas';
    const empresaTxt = this.empresaFiltro ? `Empresa: ${this.empresaFiltro}` : 'Empresa: todas';
    doc.text(rango, margin.left, 58);
    doc.text(empresaTxt, margin.left, 74);

    const head = [['Nº', 'Fecha', 'Número de factura', 'Empresa', 'CIF', 'Total €']];
    const body = this.facturas.map((f, i) => [
      (i + 1).toString(),
      f.fecha,
      f.codigo,
      f.empresa,
      f.cif,
      this.fmt(f.total ?? 0)
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
      columnStyles: { 5: { halign: 'right' } }, // Total ahora es la col 5
      showFoot: 'everyPage',
      foot: [[
        { content: '', colSpan: 3, styles: { halign: 'left' } },
        { content: '', colSpan: 3, styles: { halign: 'right' } }
      ]],
      footStyles: { fillColor: [240, 240, 240] },
      didDrawCell: (data: any) => {
        const p = data.pageNumber ?? doc.getCurrentPageInfo().pageNumber;

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
          if (data.column.index === 3) {
            doc.text(`Acumulado: ${this.fmt(cumTotals[p])} €`, cell.x + cell.width - 6, cell.y + cell.height / 2, {
              baseline: 'middle',
              align: 'right'
            });
          }
        }
      }
    });

    doc.save('facturas.pdf');
  }

  buscarEmpresas(termino: string): void {
    if (!termino || termino.length < 1) {
      this.empresasSugeridas = [];
      return;
    }
    this.empresasSvc.search(termino).subscribe(empresas => {
      this.empresasSugeridas = empresas;
    });
  }

  autocompletarCIF(): void {
    // Buscar si la empresa existe en las sugerencias
    const empresa = this.empresasSugeridas.find(e => e.nombre === this.factura.empresa);
    if (empresa) {
      this.factura.cif = empresa.cif;
    }
  }
}