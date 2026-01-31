import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, map, catchError, tap } from 'rxjs';

export interface EmpresaDTO { nombre: string; cif: string; }

@Injectable({ providedIn: 'root' })
export class EmpresasService {
  private baseUrl = 'https://contabilidad-eyy9.onrender.com/empresas';

  constructor(private http: HttpClient) {}

  getAll(): Observable<EmpresaDTO[]> {
    console.log('[EmpresasService] Llamando GET /empresas/all');
    return this.http.get<EmpresaDTO[]>(`${this.baseUrl}/all`).pipe(
      tap(res => console.log('[EmpresasService] Respuesta /empresas/all:', res)),
      catchError(err => {
        console.error('[EmpresasService] Error en /empresas/all:', err);
        return of([]);
      })
    );
  }

  getCif(nombre: string): Observable<string | null> {
    const params = new HttpParams().set('nombre', nombre);
    console.log('[EmpresasService] Llamando GET /empresas con nombre:', nombre);
    return this.http.get<{ cif: string }>(this.baseUrl, { params }).pipe(
      map(res => res?.cif ?? null),
      tap(cif => console.log('[EmpresasService] CIF recibido:', cif)),
      catchError(err => {
        console.error('[EmpresasService] Error al obtener CIF:', err);
        return of(null);
      })
    );
  }

  search(q: string): Observable<EmpresaDTO[]> {
    const params = new HttpParams().set('q', q ?? '');
    console.log('[EmpresasService] Llamando GET /empresas/search con q:', q);
    return this.http.get<EmpresaDTO[]>(`${this.baseUrl}/search`, { params }).pipe(
      tap(res => console.log('[EmpresasService] Sugerencias recibidas:', res)),
      catchError(err => {
        console.error('[EmpresasService] Error en search:', err);
        return of([]);
      })
    );
  }

  save(nombre: string, cif: string): Observable<void> {
    console.log('[EmpresasService] Guardando empresa:', { nombre, cif });
    return this.http.post<void>(this.baseUrl, { nombre, cif }).pipe(
      tap(() => console.log('[EmpresasService] Empresa guardada exitosamente')),
      catchError(err => {
        console.error('[EmpresasService] Error al guardar empresa:', err);
        return of(void 0);
      })
    );
  }
}