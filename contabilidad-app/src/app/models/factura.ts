export interface Factura {
  id?: number;
  codigo: string;
  fecha: string;
  empresa: string;
  cif: string;
  baseImponible: number;
  porcentajeIVA: number;
  valorIVA?: number;
  total?: number;
}