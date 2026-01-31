import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'esNumber',
  standalone: true
})
export class EsNumberPipe implements PipeTransform {
  transform(value: number | null | undefined, decimales: number = 2): string {
    console.log('EsNumberPipe input:', value, 'decimales:', decimales);
    if (value == null) return '';
    const resultado = value.toLocaleString('es-ES', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales
    });
    console.log('EsNumberPipe output:', resultado);
    return resultado;
  }
}