import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Factura } from '../models/factura';
import { Servicio } from '../models/servicio';
import { ReporteServicio, ReporteFactura } from '../models/reporte';

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private baseUrl = 'http://localhost:3000/reportes';

  constructor(private http: HttpClient) {}

  servicios(desde?: string, hasta?: string): Observable<{ datos: Servicio[], total: ReporteServicio }> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<{ datos: Servicio[], total: ReporteServicio }>(`${this.baseUrl}/servicios`, { params });
  }

  facturas(desde?: string, hasta?: string): Observable<{ datos: Factura[], total: ReporteFactura }> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<{ datos: Factura[], total: ReporteFactura }>(`${this.baseUrl}/facturas`, { params });
  }
}