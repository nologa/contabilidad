import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Servicio } from '../models/servicio';

@Injectable({ providedIn: 'root' })
export class ServiciosService {
  private baseUrl = 'https://contabilidad-eyy9.onrender.com/servicios';

  constructor(private http: HttpClient) {}

  list(params: { limit?: number; offset?: number; desde?: string; hasta?: string } = {}): Observable<{ datos: Servicio[]; total: number; suma: number }> {
    let httpParams = new HttpParams();
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.offset) httpParams = httpParams.set('offset', params.offset.toString());
    if (params.desde) httpParams = httpParams.set('desde', params.desde);
    if (params.hasta) httpParams = httpParams.set('hasta', params.hasta);
    return this.http.get<{ datos: any[]; total: number; suma: number }>(this.baseUrl, { params: httpParams })
      .pipe(
        map(response => ({
          datos: response.datos.map(s => ({
            id: s.id,
            fecha: s.fecha,
            codigo: s.codigo,
            importe: s.importe,
            descuento: s.descuento,
            importeFinal: s.importeFinal
          } as Servicio)),
          total: response.total,
          suma: response.suma
        }))
      );
  }

  create(servicio: Servicio): Observable<Servicio> {
    return this.http.post<Servicio>(this.baseUrl, servicio);
  }

  getById(id: number): Observable<Servicio> {
    return this.http.get<Servicio>(`${this.baseUrl}/${id}`);
  }

  update(id: number, servicio: Servicio): Observable<Servicio> {
    return this.http.put<Servicio>(`${this.baseUrl}/${id}`, servicio);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}