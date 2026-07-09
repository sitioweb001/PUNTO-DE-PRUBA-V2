# -*- coding: utf-8 -*-
"""
ERP POS LITE - Lanzador de Escritorio
=======================================

Este script convierte el sistema web (index.html) en una aplicacion de
escritorio nativa, sin necesidad de abrir un navegador manualmente.

COMO FUNCIONA:
--------------
1. El Code.gs (backend) NO se toca. Sigue viviendo en Google Apps Script,
   publicado como "Aplicacion Web", y sigue usando Google Sheets como base
   de datos. Este .py NO reemplaza eso.
2. Este script levanta un pequeno servidor web local (en tu propia PC,
   puerto aleatorio libre) que sirve los archivos index.html,
   registro-masivo.html, logo-mh.png e instructivo.md.
   Esto es necesario porque el boton "Instructivo" usa fetch('instructivo.md'),
   y eso falla si el archivo se abre directamente con doble clic
   (protocolo file://). Sirviendolo por http://localhost funciona igual
   que en un hosting normal.
3. Luego abre una ventana nativa (usando la libreria "pywebview") que
   carga esa direccion local, dandole apariencia de programa de escritorio
   real (con icono, titulo de ventana, sin barra de direcciones).
4. Todas las peticiones a Google Sheets (fetch a SCRIPT_URL) siguen
   funcionando exactamente igual, porque tu PC sigue teniendo internet.

REQUISITOS (antes de convertir a .exe):
----------------------------------------
    pip install pywebview pywin32

COMO PROBAR (sin convertir a exe todavia):
--------------------------------------------
    python app.py

COMO CONVERTIR A .EXE:
------------------------
Ver el archivo BUILD_EXE.md que acompana este script para el comando
exacto de PyInstaller.
"""

import os
import sys
import socket
import threading
import http.server
import socketserver
import webview


def resource_path(relative_path):
    """
    Devuelve la ruta real de un archivo, ya sea que el script se este
    ejecutando normal (python app.py) o ya empaquetado como .exe con
    PyInstaller (en cuyo caso los archivos van dentro de una carpeta
    temporal indicada por sys._MEIPASS).
    """
    try:
        base_path = sys._MEIPASS  # PyInstaller crea esta variable en tiempo de ejecucion
    except AttributeError:
        base_path = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_path, relative_path)


def carpeta_datos():
    """
    Devuelve la carpeta donde deben vivir los archivos de datos que el
    usuario SI puede ver y mover (como inventario.json), a diferencia de
    resource_path() que en un .exe apunta a una carpeta temporal que se
    borra al cerrar el programa.

    - Si es un .exe (PyInstaller "frozen"): la carpeta donde esta el .exe.
    - Si es "python app.py" normal: la carpeta donde esta este script.
    """
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


NOMBRE_INVENTARIO_LOCAL = "inventario.json"


class ApiEscritorio:
    """
    Funciones de Python expuestas al JavaScript de index.html a traves de
    'window.pywebview.api'. Sirven para que el boton "Actualizar Base
    Local" del modulo Inventario pueda guardar/leer inventario.json
    directamente en la misma carpeta del .exe, sin que el usuario tenga
    que mover el archivo a mano (a diferencia de cuando el sistema se usa
    desde un navegador normal, donde el archivo se descarga a la carpeta
    de Descargas por restricciones de seguridad del navegador).
    """

    def guardar_inventario_json(self, contenido):
        """Sobreescribe (o crea) inventario.json con el texto recibido."""
        ruta = os.path.join(carpeta_datos(), NOMBRE_INVENTARIO_LOCAL)
        try:
            with open(ruta, "w", encoding="utf-8") as f:
                f.write(contenido)
            return {"ok": True, "ruta": ruta}
        except Exception as ex:
            return {"ok": False, "error": str(ex)}

    def leer_inventario_json(self):
        """Devuelve el contenido de inventario.json, o None si no existe."""
        ruta = os.path.join(carpeta_datos(), NOMBRE_INVENTARIO_LOCAL)
        if not os.path.exists(ruta):
            return None
        try:
            with open(ruta, "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            return None


def encontrar_puerto_libre():
    """Busca un puerto TCP libre en la maquina local para no chocar con nada."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class ManejadorSilencioso(http.server.SimpleHTTPRequestHandler):
    """
    Igual al manejador normal de archivos estaticos, pero sin imprimir
    cada peticion en la consola (para que la ventana de fondo, si se
    llegara a ver, quede limpia).
    """
    def log_message(self, format, *args):
        pass


def iniciar_servidor_local(carpeta, puerto):
    """
    Levanta un servidor HTTP simple sirviendo 'carpeta' en 127.0.0.1:puerto.
    Corre en un hilo aparte para no bloquear la ventana de escritorio.
    """
    os.chdir(carpeta)
    handler = ManejadorSilencioso
    httpd = socketserver.TCPServer(("127.0.0.1", puerto), handler)
    hilo = threading.Thread(target=httpd.serve_forever, daemon=True)
    hilo.start()
    return httpd


def main():
    carpeta_app = resource_path(".")
    puerto = encontrar_puerto_libre()

    iniciar_servidor_local(carpeta_app, puerto)

    url = f"http://127.0.0.1:{puerto}/index.html"

    webview.create_window(
        title="ERP POS LITE",
        url=url,
        width=1280,
        height=800,
        min_size=(1000, 650),
        text_select=True,
        js_api=ApiEscritorio(),
    )
    webview.start()


if __name__ == "__main__":
    main()
