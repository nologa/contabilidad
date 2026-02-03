import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

export const rootRedirectGuard: CanActivateFn = (): boolean | UrlTree => {
  const router = inject(Router);
  const token = sessionStorage.getItem('token');

  if (token) {
    return router.createUrlTree(['/servicios']);
  }

  return true;
};
