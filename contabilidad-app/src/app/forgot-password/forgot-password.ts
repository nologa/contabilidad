import { Component, AfterViewInit, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { finalize } from 'rxjs/operators';

declare global {
  interface Window {
    onCaptchaSuccess: (token: string) => void;
    hcaptcha: any;
  }
}

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss']
})
export class ForgotPasswordComponent implements AfterViewInit {
  email = '';
  loading = false;
  error = '';
  success = false;
  captchaToken = '';
  private apiUrl = 'https://contabilidad-eyy9.onrender.com';

  constructor(
    private http: HttpClient, 
    private cd: ChangeDetectorRef, 
    private zone: NgZone,
    private renderer: Renderer2
  ) {
    // Configurar callback global para hCaptcha
    window.onCaptchaSuccess = (token: string) => {
      this.zone.run(() => {
        this.captchaToken = token;
        this.cd.detectChanges();
      });
    };
  }

  ngAfterViewInit(): void {
    // Forzar renderizado del captcha si no se carga automáticamente
    setTimeout(() => {
      if (window.hcaptcha) {
        const elements = document.querySelectorAll('.h-captcha');
        elements.forEach((element) => {
          if (!element.hasChildNodes()) {
            window.hcaptcha.render(element);
          }
        });
      }
    }, 1000);
  }

  enviar(): void {
    if (!this.email || !this.email.includes('@')) {
      this.error = 'Email inválido';
      return;
    }

    if (!this.captchaToken) {
      this.error = 'Por favor completa el captcha';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = false;

      this.http.post(`${this.apiUrl}/auth/forgot-password`, { 
        email: this.email,
        captchaToken: this.captchaToken 
      })
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
