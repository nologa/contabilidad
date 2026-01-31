import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
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

  constructor(private http: HttpClient, private cd: ChangeDetectorRef) {}

  enviar(): void {
    if (!this.email || !this.email.includes('@')) {
      this.error = 'Email inválido';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = false;

    this.http.post('http://localhost:3000/auth/forgot-password', { email: this.email })
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: () => {
          this.success = true;
          setTimeout(() => this.cd.detectChanges(), 0);
        },
        error: err => {
          this.error = err.error?.error || 'Error al enviar el email';
          this.cd.detectChanges();
        }
      });
  }
}
