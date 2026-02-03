import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';
import { ForgotPasswordComponent } from './forgot-password/forgot-password';
import { ResetPasswordComponent } from './reset-password/reset-password';
import { authGuard } from './guards/auth.guard';
import { rootRedirectGuard } from './guards/root-redirect.guard';

export const routes: Routes = [
  { path: '', component: LoginComponent, canActivate: [rootRedirectGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  
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
  
  { path: '**', redirectTo: '' }
];