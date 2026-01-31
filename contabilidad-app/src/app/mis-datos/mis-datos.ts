import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';
import { DatosPersonalesService, DatosPersonales } from '../services/datos-personales.service';

@Component({
  selector: 'app-mis-datos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mis-datos.html',
  styleUrls: ['./mis-datos.scss']
})
export class MisDatosComponent implements OnInit {
  datos: DatosPersonales = {
    nombre: '',
    nif: '',
    direccion: '',
    codigoPostal: '',
    ciudad: '',
    provincia: '',
    telefono: '',
    email: '',
    razonSocial: ''
  };

  editando = false;
  cargando = false;
  error = '';
  mensaje = '';

  constructor(private datosService: DatosPersonalesService, private cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando = true;
    this.datosService.obtener().subscribe({
      next: res => {
        this.datos = res;
        this.cargando = false;
        setTimeout(() => this.cd.detectChanges(), 0);
      },
      error: err => {
        console.error('Error al cargar datos:', err);
        this.cargando = false;
        setTimeout(() => this.cd.detectChanges(), 0);
      }
    });
  }

  activarEdicion(): void {
    this.editando = true;
    this.cd.detectChanges();
  }

  cancelar(): void {
    this.editando = false;
    this.cargarDatos();
  }

  guardar(): void {
    if (!this.datos.nombre?.trim() || !this.datos.nif?.trim()) {
      this.error = 'Nombre y NIF son requeridos';
      return;
    }

    this.cargando = true;
    this.error = '';
    this.datosService.guardar(this.datos).subscribe({
      next: () => {
        this.mensaje = 'Datos guardados correctamente';
        this.editando = false;
        this.cargando = false;
        this.cd.detectChanges();
        setTimeout(() => this.mensaje = '', 3000);
      },
      error: err => {
        this.error = 'Error al guardar los datos';
        this.cargando = false;
        this.cd.detectChanges();
      }
    });
  }
}