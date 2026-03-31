export interface Servicio {
  id?: number;
  fecha: string;
  codigo: string;
  importe: number;
  descuento: number;
  importeFinal?: number;
}