import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer.html',
  styleUrls: ['./footer.scss']
})
export class FooterComponent {
  showPrivacy = false;
  showTerms = false;

  abrirPrivacy(): void {
    this.showPrivacy = true;
  }

  cerrarPrivacy(): void {
    this.showPrivacy = false;
  }

  abrirTerms(): void {
    this.showTerms = true;
  }

  cerrarTerms(): void {
    this.showTerms = false;
  }
}