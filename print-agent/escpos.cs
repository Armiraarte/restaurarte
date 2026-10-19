using System;
using System.ComponentModel;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

// APOS Premium: ESC * 33 (24 puntos, 203 dpi), ancho maximo 576 puntos.
// Manual Axiohm 3107312, secciones 6.10 y 6.3.
public static class EscPosRaw
{
    public static byte[] Encode(Bitmap image)
    {
        if (image.Width != 576 || image.Height < 1 || image.Height > 20000)
            throw new ArgumentException("El ticket debe medir 576 puntos de ancho y hasta 20000 de alto.");
        var rect = new Rectangle(0, 0, image.Width, image.Height);
        BitmapData bits = image.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try
        {
            int stride = Math.Abs(bits.Stride);
            byte[] pixels = new byte[stride * image.Height];
            Marshal.Copy(bits.Scan0, pixels, 0, pixels.Length);
            using (var output = new MemoryStream())
            {
                output.Write(new byte[] { 27, 64, 27, 51, 24 }, 0, 5);
                for (int top = 0; top < image.Height; top += 24)
                {
                    output.Write(new byte[] { 27, 42, 33, 64, 2 }, 0, 5);
                    for (int x = 0; x < image.Width; x++)
                    {
                        for (int group = 0; group < 3; group++)
                        {
                            byte column = 0;
                            for (int bit = 0; bit < 8; bit++)
                            {
                                int y = top + group * 8 + bit;
                                if (y >= image.Height) continue;
                                int row = bits.Stride >= 0 ? y : image.Height - 1 - y;
                                int index = row * stride + x * 4;
                                int luminance = pixels[index + 2] * 299 + pixels[index + 1] * 587 + pixels[index] * 114;
                                if (luminance < 160000) column |= (byte)(128 >> bit);
                            }
                            output.WriteByte(column);
                        }
                    }
                    output.WriteByte(10);
                }
                // Restablecer interlineado, separar el contenido y cortar parcialmente.
                output.Write(new byte[] { 27, 50, 10, 29, 86, 66, 0 }, 0, 7);
                return output.ToArray();
            }
        }
        finally { image.UnlockBits(bits); }
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private class DocumentInfo
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string Name = "Ticket Los Diablitos";
        [MarshalAs(UnmanagedType.LPWStr)] public string Output = null;
        [MarshalAs(UnmanagedType.LPWStr)] public string DataType = "RAW";
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool OpenPrinter(string name, out IntPtr printer, IntPtr defaults);
    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int StartDocPrinter(IntPtr printer, int level, [In] DocumentInfo info);
    [DllImport("winspool.drv", SetLastError = true)] private static extern bool StartPagePrinter(IntPtr printer);
    [DllImport("winspool.drv", SetLastError = true)] private static extern bool WritePrinter(IntPtr printer, IntPtr data, int count, out int written);
    [DllImport("winspool.drv", SetLastError = true)] private static extern bool EndPagePrinter(IntPtr printer);
    [DllImport("winspool.drv", SetLastError = true)] private static extern bool EndDocPrinter(IntPtr printer);
    [DllImport("winspool.drv", SetLastError = true)] private static extern bool AbortPrinter(IntPtr printer);
    [DllImport("winspool.drv", SetLastError = true)] private static extern bool ClosePrinter(IntPtr printer);

    private static void Check(bool success)
    {
        if (!success) throw new Win32Exception(Marshal.GetLastWin32Error());
    }

    public static int Send(string name, byte[] data)
    {
        IntPtr printer;
        Check(OpenPrinter(name, out printer, IntPtr.Zero));
        bool started = false;
        IntPtr buffer = IntPtr.Zero;
        try
        {
            int job = StartDocPrinter(printer, 1, new DocumentInfo());
            if (job == 0) throw new Win32Exception(Marshal.GetLastWin32Error());
            started = true;
            Check(StartPagePrinter(printer));
            buffer = Marshal.AllocHGlobal(data.Length);
            Marshal.Copy(data, 0, buffer, data.Length);
            int offset = 0;
            while (offset < data.Length)
            {
                int written;
                Check(WritePrinter(printer, IntPtr.Add(buffer, offset), data.Length - offset, out written));
                if (written <= 0) throw new IOException("La impresora no acepto los datos del ticket.");
                offset += written;
            }
            Check(EndPagePrinter(printer));
            Check(EndDocPrinter(printer));
            started = false;
            return job;
        }
        finally
        {
            if (buffer != IntPtr.Zero) Marshal.FreeHGlobal(buffer);
            if (started) AbortPrinter(printer);
            ClosePrinter(printer);
        }
    }
}
