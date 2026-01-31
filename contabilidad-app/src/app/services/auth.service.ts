import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'https://contabilidad-eyy9.onrender.com';

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    console.log('[AuthService] Intentando login con:', email);
    return this.http.post(`${this.apiUrl}/auth/login`, { email, password });
  }
}