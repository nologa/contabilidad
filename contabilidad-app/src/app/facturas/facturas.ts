import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FacturasService } from '../services/facturas.service';
import { EmpresasService, EmpresaDTO } from '../services/empresas.service';
import { Factura } from '../models/factura';
import { DatosPersonalesService, DatosPersonales } from '../services/datos-personales.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-facturas',
  imports: [CommonModule, FormsModule],
  templateUrl: './facturas.html',
  styleUrls: ['./facturas.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FacturasListaComponent implements OnInit {
    facturaSeleccionada: Factura | null = null;
    // Modal detalle
    cerrarDetalle(): void {
      this.facturaSeleccionada = null;
    }

    editarFactura(f: Factura): void {
      this.editingId = f.id ?? this.obtenerIdPorCodigo(f.codigo);
      this.factura = { ...f };
      this.showFormModal = true;
      this.cerrarDetalle();
    }

    borrarFactura(f: Factura): void {
      const id = f.id ?? this.obtenerIdPorCodigo(f.codigo);
      if (!id) {
        alert('No se pudo identificar la factura a borrar');
        return;
      }
      if (!confirm('¿Seguro que deseas borrar esta factura?')) {
        return;
      }
      this.facturasService.delete(id).subscribe({
        next: () => {
          this.cerrarDetalle();
          this.cargarFacturas();
        },
        error: () => {
          alert('No se pudo borrar la factura');
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
  filtroEmpresa: string = '';
  sortBy: 'fecha' | 'empresa' = 'fecha';
  sortOrder: 'asc' | 'desc' = 'desc';
  vistaTabla = true;
  totalFacturas = 0;
  sumaTotal = 0;
  facturas: Factura[] = [];
  factura: Factura = { codigo: '', fecha: '', empresa: '', cif: '', baseImponible: 0, porcentajeIVA: 21 };
  empresas: EmpresaDTO[] = [];
  empresasSugeridas: EmpresaDTO[] = [];
  showFormModal = false;
  editingId: number | null = null;
  loading = false;
  error = '';
  datosPersonales: DatosPersonales | null = null;

  exportarPDF(): void {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = { left: 40, right: 40, top: 95, bottom: 60 };
    const pageWidth = doc.internal.pageSize.getWidth();
    const head = [['Código', 'Fecha', 'Empresa', 'CIF', 'Base Imponible', '% IVA', 'Valor IVA', 'Total']];
    const body = this.facturas.map(f => [
      f.codigo ?? '',
      f.fecha ?? '',
      f.empresa ?? '',
      f.cif ?? '',
      f.baseImponible ?? '',
      f.porcentajeIVA ?? '',
      f.valorIVA ?? '',
      f.total ?? ''
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
      columnStyles: { 4: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
      showFoot: 'everyPage',
      foot: [[
        { content: '', colSpan: 6, styles: { halign: 'left' } },
        { content: '', colSpan: 2, styles: { halign: 'right' } }
      ]],
      footStyles: { fillColor: [240, 240, 240] },
      didDrawPage: (data: any) => {
        // Encabezado con datos personales solo en la primera página
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
            doc.text(`Teléfono: ${this.datosPersonales.telefono}`, rightX, yPos, { align: 'right' });
            yPos += 12;
          }
          if (this.datosPersonales.email) {
            doc.text(`Email: ${this.datosPersonales.email}`, rightX, yPos, { align: 'right' });
            yPos += 12;
          }
        }
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('Listado de Facturas', margin.left, 40);
        doc.setFontSize(11);
        doc.text('Rango: todas las fechas', margin.left, 58);
      },
      didDrawCell: (data: any) => {
        const p = data.pageNumber || doc.getCurrentPageInfo().pageNumber;
        if (data.section === 'body' && data.column.index === 7) {
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
          if (data.column.index === 6) {
            doc.text(`Acumulado: ${cumTotals[p].toFixed(2)} €`, cell.x + cell.width - 6, cell.y + cell.height / 2, {
              baseline: 'middle',
              align: 'right'
            });
          }
        }
      }
    });
    doc.save('facturas.pdf');
  }

  constructor(
    private facturasService: FacturasService,
    private empresasService: EmpresasService,
    private datosPersonalesService: DatosPersonalesService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.empresasService.getAll().subscribe(list => (this.empresas = list));
    this.datosPersonalesService.obtener().subscribe({
      next: datos => this.datosPersonales = datos,
      error: () => this.datosPersonales = null
    });
    this.cargarFacturas();
  }

  cargarFacturas(): void {
    this.loading = true;
    this.facturasService.list().subscribe({
      next: res => {
        let lista = (res.datos as any[]).map((f: any) => ({
          ...f,
          baseImponible: f['baseimponible'] ?? f.baseImponible,
          porcentajeIVA: f['porcentajeiva'] ?? f.porcentajeIVA,
          valorIVA: f['valoriva'] ?? f.valorIVA,
          total: f['total'] ?? f.total
        }));
        
        // Extraer años únicos de los datos
        const anosUnicos = new Set<number>();
        lista.forEach(f => {
          const ano = parseInt(f.fecha.split('-')[0]);
          if (!isNaN(ano)) anosUnicos.add(ano);
        });
        this.anos = Array.from(anosUnicos).sort((a, b) => a - b);
        
        if (this.filtroDesde) {
          lista = lista.filter(f => f.fecha >= this.filtroDesde);
        }
        if (this.filtroHasta) {
          lista = lista.filter(f => f.fecha <= this.filtroHasta);
        }
        if (this.filtroEmpresa) {
          lista = lista.filter(f => f.empresa?.toLowerCase().includes(this.filtroEmpresa.toLowerCase()));
        }
        lista = lista.sort((a, b) => {
          let aVal = a[this.sortBy] || '';
          let bVal = b[this.sortBy] || '';
          if (this.sortBy === 'fecha') {
            aVal = aVal.replace(/-/g, '');
            bVal = bVal.replace(/-/g, '');
          }
          if (aVal < bVal) return this.sortOrder === 'asc' ? -1 : 1;
          if (aVal > bVal) return this.sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
        this.facturas = lista;
        this.totalFacturas = lista.length;
        this.sumaTotal = lista.reduce((acc, f) => acc + (f.total || 0), 0);
        this.loading = false;
        this.cd.detectChanges();
      },
      error: err => {
        this.error = 'No se pudieron cargar las facturas';
        this.loading = false;
      }
    });
  }

  aplicarFiltro(): void {
    this.cargarFacturas();
  }

  filtroUltimos30Dias(): void {
    const hoy = new Date();
    const desde = new Date(hoy);
    desde.setDate(hoy.getDate() - 29);
    this.filtroDesde = desde.toISOString().slice(0, 10);
    this.filtroHasta = hoy.toISOString().slice(0, 10);
    this.anoSeleccionado = '';
    this.mesSeleccionado = '';
    this.cargarFacturas();
    this.cd.detectChanges();
  }

  cambiarMes(): void {
    if (!this.anoSeleccionado) {
      this.filtroDesde = '';
      this.filtroHasta = '';
      return;
    }
    
    if (!this.mesSeleccionado) {
      // Solo año seleccionado: mostrar todo el año
      this.filtroDesde = `${this.anoSeleccionado}-01-01`;
      this.filtroHasta = `${this.anoSeleccionado}-12-31`;
    } else {
      // Año y mes seleccionados: mostrar solo ese mes
      this.filtroDesde = `${this.anoSeleccionado}-${this.mesSeleccionado}-01`;
      const ultimoDia = new Date(parseInt(this.anoSeleccionado), parseInt(this.mesSeleccionado), 0).getDate();
      this.filtroHasta = `${this.anoSeleccionado}-${this.mesSeleccionado}-${ultimoDia.toString().padStart(2, '0')}`;
    }
    this.aplicarFiltro();
  }

  borrarFiltros(): void {
    this.filtroDesde = '';
    this.filtroHasta = '';
    this.filtroEmpresa = '';
    this.cargarFacturas();
    this.cd.detectChanges();
  }

  ordenarPor(campo: 'fecha' | 'empresa') {
    if (this.sortBy === campo) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = campo;
      this.sortOrder = 'asc';
    }
    this.cargarFacturas();
  }

  abrirNueva(): void {
    this.editingId = null;
    this.factura = { codigo: '', fecha: '', empresa: '', cif: '', baseImponible: 0, porcentajeIVA: 21 };
    this.showFormModal = true;
  }

  abrirDetalle(f: Factura): void {
    this.facturaSeleccionada = f;
    // Puedes mostrar un modal o una sección con los datos de facturaSeleccionada
    // Ejemplo: this.showDetalleModal = true;
  }

  private obtenerIdPorCodigo(codigo: string): number | null {
    const encontrada = this.facturas.find(f => f.codigo === codigo && f.id != null);
    return encontrada?.id ?? null;
  }

  calcularIVA(): void {
    const base = Number(this.factura.baseImponible) || 0;
    const iva = Number(this.factura.porcentajeIVA) || 21;
    this.factura.valorIVA = Math.round(base * (iva / 100) * 100) / 100;
    this.factura.total = Math.round((base + this.factura.valorIVA) * 100) / 100;
  }

  buscarEmpresas(termino: string): void {
    if (!termino || termino.length < 1) {
      this.empresasSugeridas = [];
      return;
    }
    this.empresasService.search(termino).subscribe((empresas: EmpresaDTO[]) => {
      this.empresasSugeridas = empresas;
    });
  }

  autocompletarCIF(): void {
    const empresa: EmpresaDTO | undefined = this.empresasSugeridas.find((e: EmpresaDTO) => e.nombre === this.factura.empresa);
    if (empresa && this.factura) {
      this.factura.cif = empresa.cif;
    }
  }

  validarCIF(cif: string): boolean {
    // Formato: letra + 8 dígitos (ej: A12345678)
    const regexCIF = /^[A-Z][0-9]{8}$/;
    return regexCIF.test(cif.toUpperCase());
  }

  guardarFactura(): void {
    this.calcularIVA();
    
    // Validar campos obligatorios
    if (!this.factura.codigo || !this.factura.fecha || !this.factura.empresa || !this.factura.cif) {
      alert('Todos los campos son obligatorios');
      return;
    }

    // Validar formato CIF (letra + 8 números)
    if (!this.validarCIF(this.factura.cif)) {
      alert('El CIF debe tener el formato: una letra seguida de 8 números (ej: A12345678)');
      return;
    }

    // Validar base imponible > 0
    if (this.factura.baseImponible <= 0) {
      alert('La base imponible debe ser mayor que 0');
      return;
    }

    const existe: EmpresaDTO | undefined = this.empresas.find((e: EmpresaDTO) => e.nombre === this.factura.empresa);
    if (!existe) {
      this.empresasService.save(this.factura.empresa, this.factura.cif).subscribe();
    }
    const op = this.editingId
      ? this.facturasService.update(this.editingId, this.factura)
      : this.facturasService.create(this.factura);
    op.subscribe(() => {
      this.showFormModal = false;
      this.cargarFacturas();
    });
  }
}
