package com.azhagifarm.milk;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

@CapacitorPlugin(name = "WhatsAppShare")
public class WhatsAppSharePlugin extends Plugin {

    @PluginMethod
    public void sharePdf(PluginCall call) {
        String filePath = call.getString("filePath");
        String phone = call.getString("phone");
        String text = call.getString("text", "");

        if (filePath == null || filePath.isEmpty()) {
            call.reject("filePath is required");
            return;
        }

        try {
            Uri parsedUri = Uri.parse(filePath);
            File file;
            if ("file".equalsIgnoreCase(parsedUri.getScheme())) {
                file = new File(parsedUri.getPath());
            } else {
                file = new File(filePath);
            }

            if (!file.exists()) {
                call.reject("File does not exist at path: " + filePath);
                return;
            }

            Uri contentUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );

            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("application/pdf");
            intent.putExtra(Intent.EXTRA_STREAM, contentUri);
            if (text != null && !text.isEmpty()) {
                intent.putExtra(Intent.EXTRA_TEXT, text);
            }
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                intent.setClipData(ClipData.newRawUri("", contentUri));
            }

            // Normalize phone number (digits only, e.g. 9876543210 -> 919876543210)
            String cleanPhone = phone != null ? phone.replaceAll("[^0-9]", "") : "";
            if (cleanPhone.length() == 10) {
                cleanPhone = "91" + cleanPhone;
            }

            boolean launched = false;

            // 1. First attempt: Launch WhatsApp directly pre-selecting the recipient contact
            if (!cleanPhone.isEmpty()) {
                try {
                    Intent waIntent = new Intent(intent);
                    waIntent.setPackage("com.whatsapp");
                    waIntent.putExtra("jid", cleanPhone + "@s.whatsapp.net");
                    getActivity().startActivity(waIntent);
                    launched = true;
                } catch (Exception ex1) {
                    // Try WhatsApp Business with jid
                    try {
                        Intent wbIntent = new Intent(intent);
                        wbIntent.setPackage("com.whatsapp.w4b");
                        wbIntent.putExtra("jid", cleanPhone + "@s.whatsapp.net");
                        getActivity().startActivity(wbIntent);
                        launched = true;
                    } catch (Exception ex2) {
                        // Will fallback to package without jid
                    }
                }
            }

            // 2. Second attempt: Launch WhatsApp directly (user chooses contact from WhatsApp)
            if (!launched) {
                try {
                    Intent waIntent = new Intent(intent);
                    waIntent.setPackage("com.whatsapp");
                    getActivity().startActivity(waIntent);
                    launched = true;
                } catch (Exception ex3) {
                    try {
                        Intent wbIntent = new Intent(intent);
                        wbIntent.setPackage("com.whatsapp.w4b");
                        getActivity().startActivity(wbIntent);
                        launched = true;
                    } catch (Exception ex4) {
                        // Will fallback to chooser
                    }
                }
            }

            // 3. Third attempt: Open native share chooser with PDF attached
            if (!launched) {
                Intent chooser = Intent.createChooser(intent, "Share PDF Bill via WhatsApp");
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().startActivity(chooser);
            }

            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to share PDF: " + e.getMessage(), e);
        }
    }
}
