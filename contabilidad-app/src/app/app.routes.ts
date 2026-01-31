import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';
import { ForgotPasswordComponent } from './forgot-password/forgot-password';
import { ResetPasswordComponent } from './reset-password/reset-password';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  
  // Lazy loading para módulos protegidos (se cargan bajo demanda)
  { 
    path: 'facturas', 
    loadComponent: () => import('./facturas/facturas').then(m => m.FacturasListaComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'servicios', 
    loadComponent: () => import('./servicios/servicios').then(m => m.ServiciosListaComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'mis-datos', 
    loadComponent: () => import('./mis-datos/mis-datos').then(m => m.MisDatosComponent),
    canActivate: [authGuard] 
  },
  
  { path: '', redirectTo: 'facturas', pathMatch: 'full' },
  { path: '**', redirectTo: 'facturas' }
];