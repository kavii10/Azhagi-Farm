import type jsPDF from 'jspdf';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Robust cross-platform PDF downloader for Web and Mobile (Capacitor Android).
 * On Mobile:
 * 1. Writes base64 PDF to Cache/Documents directory via @capacitor/filesystem
 * 2. Opens native Android Share/Save dialog via @capacitor/share
 * 3. Falls back to HTML5 anchor download
 * On Web:
 * Standard browser file download via doc.save() and blob anchor
 */
export async function savePdfCrossPlatform(
  doc: jsPDF,
  fileName: string,
  title?: string
): Promise<void> {
  const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const shareTitle = title || cleanFileName.replace('.pdf', '');

  // Detect if running inside Capacitor native mobile app
  const isCapacitorNative =
    typeof (window as any).Capacitor !== 'undefined' &&
    typeof (window as any).Capacitor.isNativePlatform === 'function' &&
    (window as any).Capacitor.isNativePlatform();

  if (isCapacitorNative) {
    try {
      // Get base64 string from jsPDF (remove data URI prefix if present)
      const dataUri = doc.output('datauristring');
      const base64Data = dataUri.split(',')[1];

      // Save file to mobile device cache
      const savedFile = await Filesystem.writeFile({
        path: cleanFileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      // Open native mobile share dialog (allows saving to Downloads, Drive, WhatsApp, etc.)
      await Share.share({
        title: shareTitle,
        text: `${shareTitle} from Azhagi Farm`,
        url: savedFile.uri,
        dialogTitle: `Save or Share ${shareTitle}`,
      });

      return;
    } catch (mobileErr) {
      console.warn('[PDF Download] Mobile native share error, falling back to browser download:', mobileErr);
    }
  }

  // Standard Web / Browser download
  try {
    doc.save(cleanFileName);
  } catch (saveErr) {
    console.warn('[PDF Download] doc.save failed, using blob fallback:', saveErr);
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = cleanFileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1000);
  }
}
