package com.rmlist.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Downloads an update APK into the app cache and hands it to the system installer.
 * Android always shows its own confirmation screen, so nothing installs silently.
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {

    private static final long MAX_BYTES = 100L * 1024 * 1024;

    /** Whether the user has allowed this app to install packages (Android 8+). */
    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("allowed", Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(ret);
    }

    /** Opens the system page where the user can allow installs from this app. */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /**
     * Fetches a small text file (the update manifest) natively. The web view can't do this itself:
     * the app page is https://localhost, and Android blocks it from loading plain http:// addresses.
     */
    @PluginMethod
    public void getText(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
            call.reject("Invalid URL");
            return;
        }
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setUseCaches(false);
                int status = conn.getResponseCode();
                if (status != 200) throw new Exception("Server answered " + status);
                StringBuilder sb = new StringBuilder();
                try (InputStream in = conn.getInputStream()) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        sb.append(new String(buf, 0, n, java.nio.charset.StandardCharsets.UTF_8));
                        if (sb.length() > 64 * 1024) throw new Exception("Response too large");
                    }
                }
                JSObject ret = new JSObject();
                ret.put("text", sb.toString());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Request failed");
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    /** Downloads `url` (http/https only) and launches the installer. */
    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
            call.reject("Invalid update URL");
            return;
        }
        call.setKeepAlive(true);

        new Thread(() -> {
            File dir = new File(getContext().getCacheDir(), "updates");
            File apk = new File(dir, "update.apk");
            HttpURLConnection conn = null;
            try {
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("Could not create cache folder");
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.connect();
                if (conn.getResponseCode() != 200) throw new Exception("Server answered " + conn.getResponseCode());

                long total = conn.getContentLengthLong();
                if (total > MAX_BYTES) throw new Exception("Update file is too large");

                try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[64 * 1024];
                    long done = 0;
                    int lastPct = -1;
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        done += n;
                        if (done > MAX_BYTES) throw new Exception("Update file is too large");
                        out.write(buf, 0, n);
                        if (total > 0) {
                            int pct = (int) (done * 100 / total);
                            if (pct != lastPct) {
                                lastPct = pct;
                                JSObject p = new JSObject();
                                p.put("percent", pct);
                                notifyListeners("progress", p);
                            }
                        }
                    }
                }

                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                apk.delete();
                call.reject(e.getMessage() != null ? e.getMessage() : "Download failed");
            } finally {
                if (conn != null) conn.disconnect();
                call.setKeepAlive(false);
            }
        }).start();
    }
}
