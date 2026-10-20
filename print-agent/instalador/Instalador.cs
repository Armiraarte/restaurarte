// Instalador de impresión de SOFT RESTAURANTE en un solo .exe: trae dentro paquete.zip (drivers, Node.js, agente
// de impresión y config.env). Pide permiso de administrador (manifiesto), lo descomprime en una carpeta temporal y
// corre instalar.ps1 en esta misma ventana. Lo arma crear-instalador.ps1.
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;

[assembly: AssemblyTitle("Instalador de impresoras de SOFT RESTAURANTE")]
[assembly: AssemblyProduct("SOFT RESTAURANTE")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

static class Instalador
{
    static int Main(string[] args)
    {
        Console.Title = "SOFT RESTAURANTE - Instalador de impresoras";
        string carpeta = Path.Combine(Path.GetTempPath(), "SoftRestaurante-instalador-" + Process.GetCurrentProcess().Id);
        try
        {
            Console.WriteLine("Preparando el instalador...");
            using (Stream paquete = Assembly.GetExecutingAssembly().GetManifestResourceStream("paquete.zip"))
            using (ZipArchive zip = new ZipArchive(paquete))
            {
                zip.ExtractToDirectory(carpeta);
            }

            // Los argumentos se pasan tal cual a instalar.ps1 (pruebas: -SoloArchivos -Destino ... -SinPausa).
            string extra = "";
            foreach (string arg in args) extra += " \"" + arg.Replace("\"", "") + "\"";
            ProcessStartInfo inicio = new ProcessStartInfo(
                Path.Combine(Environment.SystemDirectory, @"WindowsPowerShell\v1.0\powershell.exe"),
                "-NoProfile -ExecutionPolicy Bypass -File \"" + Path.Combine(carpeta, "instalar.ps1") + "\"" + extra);
            inicio.UseShellExecute = false;
            using (Process proceso = Process.Start(inicio))
            {
                proceso.WaitForExit();
                return proceso.ExitCode;
            }
        }
        catch (Exception e)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("No se pudo instalar: " + e.Message);
            Console.ResetColor();
            Console.WriteLine("Presiona Enter para cerrar.");
            Console.ReadLine();
            return 1;
        }
        finally
        {
            try { Directory.Delete(carpeta, true); } catch { }
        }
    }
}
