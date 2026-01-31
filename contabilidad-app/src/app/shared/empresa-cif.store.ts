export interface EmpresaItem { nombre: string; cif?: string }

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class EmpresaCifStore {
  private key = 'empresasCif_v1';

  private read(): EmpresaItem[] {
    try { return JSON.parse(localStorage.getItem(this.key) || '[]'); } catch { return []; }
  }
  private write(list: EmpresaItem[]) {
    localStorage.setItem(this.key, JSON.stringify(list));
  }

  getCif(nombre: string): string | undefined {
    const n = (nombre || '').trim().toLowerCase();
    return this.read().find(e => e.nombre.trim().toLowerCase() === n)?.cif;
  }

  set(nombre: string, cif?: string): void {
    const n = (nombre || '').trim();
    if (!n) return;
    const list = this.read();
    const i = list.findIndex(e => e.nombre.trim().toLowerCase() === n.toLowerCase());
    if (i >= 0) {
      list[i] = { nombre: n, cif: (cif || list[i].cif || '').toUpperCase() || undefined };
    } else {
      list.push({ nombre: n, cif: (cif || '').toUpperCase() || undefined });
    }
    this.write(list);
  }

  search(prefix: string): EmpresaItem[] {
    const p = (prefix || '').trim().toLowerCase();
    if (!p) return [];
    return this.read()
      .filter(e => e.nombre.toLowerCase().startsWith(p))
      .slice(0, 10);
  }
}