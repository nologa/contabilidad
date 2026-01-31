import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Factura } from '../models/factura';

@Injectable({ providedIn: 'root' })
export class FacturasService {
  private baseUrl = 'https://contabilidad-eyy9.onrender.com/facturas';

  constructor(private http: HttpClient) {}

  list(params: { limit?: number; offset?: number; desde?: string; hasta?: string; empresa?: string } = {}): Observable<{ datos: Factura[]; total: number; suma: number }> {
    let httpParams = new HttpParams();
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.offset) httpParams = httpParams.set('offset', params.offset.toString());
    if (params.desde) httpParams = httpParams.set('desde', params.desde);
    if (params.hasta) httpParams = httpParams.set('hasta', params.hasta);
    if (params.empresa) httpParams = httpParams.set('empresa', params.empresa);
    return this.http.get<{ datos: Factura[]; total: number; suma: number }>(this.baseUrl, { params: httpParams });
  }

  create(factura: Factura): Observable<Factura> {
    return this.http.post<Factura>(this.baseUrl, factura);
  }

  getById(id: number): Observable<Factura> {
    return this.http.get<Factura>(`${this.baseUrl}/${id}`);
  }

  update(id: number, factura: Factura): Observable<Factura> {
    return this.http.put<Factura>(`${this.baseUrl}/${id}`, factura);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}