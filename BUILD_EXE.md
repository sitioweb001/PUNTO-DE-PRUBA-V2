# Cómo convertir ERP POS LITE en un .exe

Importante: PyInstaller genera el `.exe` para el sistema operativo en el que
lo ejecutás. Es decir, este paso tenés que hacerlo **en una PC con Windows**
(no sirve generarlo desde Mac/Linux para que corra en Windows).

## 1. Archivos que necesitás juntos en una misma carpeta

```
erp_exe/
├── app.py
├── index.html
├── registro-masivo.html
├── logo-mh.png
├── instructivo.md
└── requirements.txt
```

## 2. Instalar Python (si no lo tenés)

Descargá Python 3.11 o 3.12 desde https://www.python.org/downloads/
Al instalar, marcá la casilla **"Add Python to PATH"**.

## 3. Instalar las dependencias

Abrí la terminal (CMD o PowerShell) dentro de la carpeta `erp_exe` y corré:

```
pip install -r requirements.txt
```

## 4. Probar que funciona antes de empaquetar

```
python app.py
```

Debería abrirse una ventana con tu sistema completo (Login, Ventas,
Inventario, etc.), funcionando exactamente igual que en el navegador,
incluyendo el botón **Soporte → Instructivo** y el logo del Ministerio
de Hacienda.

## 5. Generar el .exe

Desde la misma carpeta, corré este comando (todo en una sola línea):

```
pyinstaller --onefile --windowed --name "ERP_POS_LITE" --add-data "index.html;." --add-data "registro-masivo.html;." --add-data "logo-mh.png;." --add-data "instructivo.md;." app.py
```

Explicación rápida de las opciones:
- `--onefile` → genera un único archivo .exe (más fácil de compartir).
- `--windowed` → no muestra la consola negra de fondo.
- `--add-data "archivo;."` → incluye ese archivo dentro del .exe para que
  esté disponible al ejecutarse (el `;.` es el separador en Windows; en
  Mac/Linux sería `:` en vez de `;`).

## 6. ¿Dónde queda el .exe?

PyInstaller crea varias carpetas. El ejecutable final queda en:

```
erp_exe/dist/ERP_POS_LITE.exe
```

Ese es el único archivo que necesitás compartir/instalar en otras PCs.
No hace falta llevar `index.html`, `logo-mh.png`, etc. por separado:
quedaron empaquetados dentro del .exe.

## 7. (Opcional) Ponerle un ícono propio

Si tenés un ícono `.ico` (por ejemplo `logo.ico`), agregá al comando:

```
--icon "logo.ico"
```

## 8. Notas importantes

- El `Code.gs` **no se toca ni se incluye** en este .exe. Sigue publicado
  como Aplicación Web de Google Apps Script, y el .exe le sigue hablando
  por internet exactamente igual que hacía el navegador.
- El .exe necesita conexión a internet para funcionar (porque Google
  Sheets, la cámara vía CDN, etc. lo requieren), igual que la versión web.
- Si en el futuro cambiás `index.html`, `registro-masivo.html`,
  `logo-mh.png` o `instructivo.md`, tenés que volver a correr el comando
  del paso 5 para regenerar el .exe con los cambios.
- Windows Defender / SmartScreen puede marcar el .exe como "desconocido"
  la primera vez que se abre en otra PC, porque no está firmado
  digitalmente. Eso es normal en ejecutables generados con PyInstaller;
  hay que darle "Más información → Ejecutar de todas formas".
