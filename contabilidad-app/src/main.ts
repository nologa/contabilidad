import 'bootstrap/dist/css/bootstrap.min.css';
import { bootstrapApplication } from '@angular/platform-browser';
import { Component, LOCALE_ID, isDevMode } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { routes } from './app/app.routes';
import { provideHttpClient, withInterceptors, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { HeaderComponent } from './app/layout/header';

import { FooterComponent } from './app/layout/footer';
import { provideServiceWorker } from '@angular/service-worker';

registerLocaleData(localeEs, 'es');

export const authInterceptor = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  template: `
    <app-header></app-header>
    <div class="container-fluid py-3 flex-grow-1">
      <router-outlet></router-outlet>
    </div>
    <app-footer></app-footer>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
  `]
})
class App {}

bootstrapApplication(App, {
  providers: [
    provideRouter(routes, withRouterConfig({ onSameUrlNavigation: 'reload' })),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'es' }, provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          })
  ]
});