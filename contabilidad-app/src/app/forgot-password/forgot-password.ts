import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss']
})
export class ForgotPasswordComponent {
  email = '';
  loading = false;
  error = '';
  success = false;
  private apiUrl = 'https://contabilidad-eyy9.onrender.com';

  constructor(private http: HttpClient, private cd: ChangeDetectorRef, private zone: NgZone) {}

  enviar(): void {
    if (!this.email || !this.email.includes('@')) {
      this.error = 'Email inválido';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = false;

      this.http.post(`${this.apiUrl}/auth/forgot-password`, { email: this.email })
        .pipe(finalize(() => this.loading = false))
        .subscribe({
          next: () => {
            this.success = true;
            this.cd.markForCheck();
          },
          error: err => {
            this.error = err.error?.error || 'Error al enviar el email';
            this.cd.markForCheck();
          }
        });
  }
}
