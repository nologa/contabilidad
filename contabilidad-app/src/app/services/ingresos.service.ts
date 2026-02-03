import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Ingreso } from '../models/ingreso';

@Injectable({ providedIn: 'root' })
export class IngresosService {
  private baseUrl = 'https://contabilidad-eyy9.onrender.com/ingresos';

  constructor(private http: HttpClient) {}

  list(params: { limit?: number; offset?: number; desde?: string; hasta?: string } = {}): Observable<{ datos: Ingreso[]; total: number; suma: number }> {
    let httpParams = new HttpParams();
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.offset) httpParams = httpParams.set('offset', params.offset.toString());
    if (params.desde) httpParams = httpParams.set('desde', params.desde);
    if (params.hasta) httpParams = httpParams.set('hasta', params.hasta);
    return this.http.get<{ datos: Ingreso[]; total: number; suma: number }>(this.baseUrl, { params: httpParams });
  }

  create(ingreso: Ingreso): Observable<Ingreso> {
    return this.http.post<Ingreso>(this.baseUrl, ingreso);
  }

  getById(id: number): Observable<Ingreso> {
    return this.http.get<Ingreso>(`${this.baseUrl}/${id}`);
  }

  update(id: number, ingreso: Ingreso): Observable<Ingreso> {
    return this.http.put<Ingreso>(`${this.baseUrl}/${id}`, ingreso);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
