# Terneros y Vacas

App para registrar la compra, el engorde y la venta de terneros, y el rodeo de vacas (stock, cría, gastos).
Funciona sin internet y puede sincronizar con una planilla de Google Drive.

## Archivos

| Archivo | Qué es |
|---|---|
| `terneros/index.html` | Las pantallas de la app. Se abre con doble clic (junto con `logica.js`, que tiene que estar en la misma carpeta). |
| `terneros/logica.js` | Los cálculos (stock, ganancia, reparto de gastos, inflación). |
| `terneros/tests.html` | Pruebas de los cálculos: abrirlo en el navegador y tiene que decir "Todo bien". |
| `terneros/sw.js`, `manifest.webmanifest`, `icons/` | Para instalarla como app y abrirla sin internet (solo si está publicada en https). |
| `terneros/drive/Codigo.gs` | Código de la planilla de Google (Apps Script) que recibe los datos de la app. |
| `terneros/drive/appsscript.json` | Configuración de ese Apps Script. |
| `terneros/drive/COMO-ARMAR-LA-PLANTILLA.md` | Pasos para armar la planilla modelo (una sola vez). |

## Dónde quedan los datos

Los datos **no** están en estos archivos: se guardan en el navegador de cada celular y, si está conectado,
en la planilla de Google Drive de la persona. Reemplazar `index.html` por una versión nueva no borra nada.

## Probarla en la computadora

```bash
python -m http.server 8765 --directory terneros
```

y abrir <http://localhost:8765>.

## Probar los cálculos

Abrir `terneros/tests.html` en el navegador. Correrlo después de tocar `logica.js`.

## Instalarla en el celular

El service worker solo funciona si la app se abre por https (o localhost), no con doble clic. Una vez publicada
(por ejemplo en GitHub Pages), en Chrome: menú → *Instalar app*; en iPhone: Compartir → *Agregar a pantalla de inicio*.
Cuando cambies `index.html` o `logica.js`, subí el número `VERSION` de `sw.js` para que los celulares bajen la versión nueva.
