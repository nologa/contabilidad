import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';

  constructor(private authService: AuthService, private router: Router) {}

  login(): void {
    this.authService.login(this.email, this.password).subscribe({
      next: (response: any) => {
        console.log('[Login] Response completa:', response);
        console.log('[Login] Token:', response.token);
        console.log('[Login] Authorization:', response.authorization);
        
        const token = response.token || response.authorization || response.access_token;
        if (token) {
          localStorage.setItem('token', token);
          this.router.navigate(['']);
        } else {
          this.error = 'No se recibió token del servidor';
          console.error('[Login] Respuesta sin token:', response);
        }
      },
      error: (err: any) => {
        console.error('[Login] Error:', err);
        this.error = err.error?.message || 'Error en el login';
      }
    });
  }
}