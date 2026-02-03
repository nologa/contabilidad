import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, NavigationEnd } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.html',
  styleUrls: ['./header.scss']
})
export class HeaderComponent {
  isLogin = true;

  constructor(private router: Router) {
    this.updateIsLogin();
    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) this.updateIsLogin();
    });
  }

  private updateIsLogin(): void {
    const url = this.router.url;
    this.isLogin = url.startsWith('/login') || url.startsWith('/forgot-password') || url.startsWith('/reset-password') || url === '/';
  }

  logout(): void {
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }
}