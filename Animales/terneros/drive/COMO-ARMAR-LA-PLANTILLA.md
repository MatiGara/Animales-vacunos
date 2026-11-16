# Cómo armar la planilla modelo (una sola vez)

Esto lo hace quien distribuye la app, no la persona que la usa.
La planilla modelo ya trae el código adentro: cada persona hace "Hacer una copia" desde la app
y la copia queda en su propio Drive, con sus datos y nadie más con acceso.

## 1. Crear la planilla

1. Entrá a <https://sheets.new> con tu cuenta de Google.
2. Ponele de nombre **Terneros**. Ese nombre es el que verá la persona en su copia.

## 2. Pegar el código

1. Menú **Extensiones → Apps Script**.
2. Arriba a la izquierda, cambiá el nombre del proyecto ("Proyecto sin título") por **Terneros**.
   Es el nombre que aparece cuando Google pide permisos.
3. En el archivo `Código.gs`, borrá todo y pegá el contenido de **`Codigo.gs`**.
4. Mostrá el manifiesto: **Configuración del proyecto** (engranaje, a la izquierda) →
   tildá **"Mostrar el archivo de manifiesto appsscript.json en el editor"**.
5. Volvé a **Editor** (`< >`), abrí `appsscript.json`, borrá todo y pegá el contenido de **`appsscript.json`**.
6. Guardá con el disquete o `Ctrl+S`.

## 3. Preparar la hoja de inicio

1. Arriba, en la lista de funciones, elegí **`prepararPlantilla`** y tocá **Ejecutar**.
2. Google pide permisos. Aceptá:
   **Revisar permisos → tu cuenta → Configuración avanzada → Ir a Terneros (no seguro) → Permitir**.
3. Volvé a la planilla: tiene que haber una hoja **Inicio** con los pasos, y las hojas
   Compras, Ventas, Stock y Gastos vacías.

> **No hagas "Implementar" en la plantilla.** Cada persona implementa su propia copia.

## 4. Compartir la plantilla

1. En la planilla: **Compartir** → en "Acceso general" elegí
   **Cualquier persona con el enlace** → rol **Lector** → Listo.
2. Copiá el enlace. Tiene esta forma:
   `https://docs.google.com/spreadsheets/d/ESTE-ES-EL-ID/edit?usp=sharing`
3. La parte entre `/d/` y `/edit` es el **ID de la plantilla**.

## 5. Ponerle el ID a la app

En `index.html`, buscá esta línea (cerca del final):

```js
const PLANTILLA_ID = '';
```

y pegá el ID entre las comillas:

```js
const PLANTILLA_ID = '1AbCdEf...';
```

Con eso, el botón **"Abrir la planilla para copiarla"** de la guía lleva directo a
`https://docs.google.com/spreadsheets/d/ID/copy`, y Google le pregunta a la persona
"¿Querés hacer una copia?".

## Si cambiás el código más adelante

Las copias que ya hizo la gente **no se actualizan solas**. Cada persona tendría que pegar el
código nuevo y hacer **Implementar → Gestionar implementaciones → Editar (lápiz) → Versión: Nueva versión**.
Así la dirección `/exec` sigue siendo la misma. Por eso conviene cambiar el código lo menos posible.
