import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface DatosPersonales {
  id?: number;
  nombre: string;
  nif: string;
  direccion?: string;
  codigoPostal?: string;
  ciudad?: string;
  provincia?: string;
  telefono?: string;
  email?: string;
  razonSocial?: string;
}

@Injectable({ providedIn: 'root' })
export class DatosPersonalesService {
  private baseUrl = 'https://contabilidad-eyy9.onrender.com/datosPersonales';

  constructor(private http: HttpClient) {}

  obtener(): Observable<DatosPersonales> {
    return this.http.get<DatosPersonales>(this.baseUrl).pipe(
      tap(res => console.log('[DatosPersonalesService] Datos obtenidos:', res)),
      catchError(err => {
        console.error('[DatosPersonalesService] Error al obtener:', err);
        return of({} as DatosPersonales);
      })
    );
  }

  guardar(datos: DatosPersonales): Observable<DatosPersonales> {
    console.log('[DatosPersonalesService] Enviando datos:', datos);
    console.log('[DatosPersonalesService] URL:', this.baseUrl);
    console.log('[DatosPersonalesService] Token:', sessionStorage.getItem('token') ? 'Sí hay token' : 'NO HAY TOKEN');
    
    return this.http.post<DatosPersonales>(this.baseUrl, datos).pipe(
      tap(res => console.log('[DatosPersonalesService] Datos guardados:', res)),
      catchError(err => {
        console.error('[DatosPersonalesService] Error completo al guardar:', err);
        console.error('[DatosPersonalesService] Estado:', err.status);
        console.error('[DatosPersonalesService] Mensaje:', err.error);
        throw err;
      })
    );
  }
}