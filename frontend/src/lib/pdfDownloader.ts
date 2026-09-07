import type jsPDF from 'jspdf';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Robust cross-platform PDF downloader for Web and Mobile (Capacitor Android).
 *
 * When the user taps "Download PDF":
 * 1. On Mobile: Writes base64 PDF directly into public Documents directory
 *    (accessible in the phone's file manager / Downloads).
 * 2. On Web: Downloads directly to browser Downloads via doc.save() and blob anchor.
 * 3. Does NOT hijack the download with a Share sheet.
 */
export interface PdfDownloadResult {
  folder: string;
  fileName: string;
  uri?: string;
}

export async function savePdfCrossPlatform(
  doc: jsPDF,
  fileName: string,
  _title?: string
): Promise<PdfDownloadResult> {
  const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  // Detect if running inside Capacitor native mobile app
  const isCapacitorNative =
    typeof (window as any).Capacitor !== 'undefined' &&
    typeof (window as any).Capacitor.isNativePlatform === 'function' &&
    (window as any).Capacitor.isNativePlatform();

  if (isCapacitorNative) {
    try {
      const dataUri = doc.output('datauristring');
      const base64Data = dataUri.split(',')[1];

      // Request storage permission if supported
      try {
        await Filesystem.requestPermissions();
      } catch {
        // Continue if permissions call not supported
      }

      // 1. Try writing directly to Download folder on Android public storage
      try {
        const savedFile = await Filesystem.writeFile({
          path: `Download/${cleanFileName}`,
          data: base64Data,
          directory: Directory.ExternalStorage,
          recursive: true,
        });
        console.log('[PDF Download] Saved to Downloads folder:', savedFile.uri);
        return { folder: 'Downloads', fileName: cleanFileName, uri: savedFile.uri };
      } catch (dlErr) {
        console.warn('[PDF Download] Write to Download failed, trying Documents:', dlErr);
      }

      // 2. Fallback: Write directly to Documents directory on mobile device
      try {
        const savedFile = await Filesystem.writeFile({
          path: cleanFileName,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });
        console.log('[PDF Download] Saved to Documents folder:', savedFile.uri);
        return { folder: 'Documents', fileName: cleanFileName, uri: savedFile.uri };
      } catch (docErr) {
        console.warn('[PDF Download] Write to Documents failed, trying External storage:', docErr);
      }

      // 3. Fallback: Try External Storage root or Cache
      try {
        const savedFile = await Filesystem.writeFile({
          path: cleanFileName,
          data: base64Data,
          directory: Directory.External,
          recursive: true,
        });
        console.log('[PDF Download] Saved to External storage:', savedFile.uri);
        return { folder: 'Files', fileName: cleanFileName, uri: savedFile.uri };
      } catch (extErr) {
        console.warn('[PDF Download] Write to External failed:', extErr);
      }
    } catch (mobileErr) {
      console.warn('[PDF Download] Mobile native filesystem error, falling back to browser download:', mobileErr);
    }
  }

  // Standard Web / Browser download
  try {
    doc.save(cleanFileName);
    return { folder: 'Downloads', fileName: cleanFileName };
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
    return { folder: 'Downloads', fileName: cleanFileName };
  }
}

/**
 * Dedicated PDF Sharer for Mobile & Web.
 * Use this when the user explicitly clicks "Share PDF".
 */
export async function sharePdfCrossPlatform(
  doc: jsPDF,
  fileName: string,
  title?: string
): Promise<void> {
  const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const shareTitle = title || cleanFileName.replace('.pdf', '');

  const isCapacitorNative =
    typeof (window as any).Capacitor !== 'undefined' &&
    typeof (window as any).Capacitor.isNativePlatform === 'function' &&
    (window as any).Capacitor.isNativePlatform();

  if (isCapacitorNative) {
    try {
      const dataUri = doc.output('datauristring');
      const base64Data = dataUri.split(',')[1];

      const savedFile = await Filesystem.writeFile({
        path: cleanFileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      await Share.share({
        title: shareTitle,
        text: `${shareTitle} from Azhagi Farm`,
        url: savedFile.uri,
        dialogTitle: `Share ${shareTitle}`,
      });
      return;
    } catch (e) {
      console.warn('[PDF Share] Native share failed:', e);
    }
  }

  // Web fallback: download if share not supported
  await savePdfCrossPlatform(doc, cleanFileName, title);
}
